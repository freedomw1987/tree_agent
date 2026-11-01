// src/types.ts
function transcriptSortKey(e) {
  return `${e.ts}#${e.requestId}#${e.role}`;
}
function transcriptCursor(e) {
  return `${e.ts}:${e.requestId}:${e.role}`;
}

// src/relay-client.ts
var RelayClient = class {
  opts;
  constructor(opts) {
    this.opts = opts;
  }
  makeRequestId() {
    if (this.opts.newRequestId) return this.opts.newRequestId();
    return `req-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  }
  /**
   * App 端：派任務
   *  - 冪等：同 requestId 重試 → 只入庫一次、只入隊一次
   *  - 回傳 requestId（之後用嚟對結果）
   */
  async sendTask(input) {
    const requestId = input.requestId ?? this.makeRequestId();
    const ts = Date.now();
    const existing = await this.opts.tasks.get(requestId);
    if (existing) return requestId;
    await this.opts.transcript.append({
      userId: this.opts.userId,
      requestId,
      role: "user",
      kind: input.kind ?? "text",
      content: input.text,
      ts
    });
    await this.opts.tasks.put({
      requestId,
      userId: this.opts.userId,
      status: "queued",
      title: input.title ?? input.text.slice(0, 24),
      updatedAt: ts
    });
    await this.opts.tasksQueue.send(
      requestId,
      JSON.stringify({ requestId, userId: this.opts.userId, text: input.text, ts })
    );
    return requestId;
  }
  /**
   * Sidecar 端：長輪詢攞任務
   *  - 收到即 ack（避免重複投遞；真實世界要喺處理完先 ack → 見 TODO）
   */
  async pollTasks(handler) {
    const messages = await this.opts.tasksQueue.poll(2e4, 10);
    for (const m of messages) {
      let payload;
      try {
        payload = JSON.parse(m.body);
      } catch {
        await this.opts.tasksQueue.ack(m);
        continue;
      }
      await handler(payload);
      await this.opts.tasksQueue.ack(m);
    }
  }
  /**
   * Sidecar 端：並行取任務（唔會俾一個卡住嘅任務阻塞成條 queue）
   *
   * 場景：任務 A 等緊用戶批核確認卡（可能等 5 分鐘），
   *       如果順序處理，後面嘅任務 B 就會被卡住 → 所以要並行。
   */
  async pollTasksConcurrent(handler) {
    const messages = await this.opts.tasksQueue.poll(2e4, 10);
    for (const m of messages) {
      let payload;
      try {
        payload = JSON.parse(m.body);
      } catch {
        await this.opts.tasksQueue.ack(m);
        continue;
      }
      void (async () => {
        try {
          await handler(payload);
        } catch {
        } finally {
          await this.opts.tasksQueue.ack(m);
        }
      })();
    }
  }
  /**
   * Sidecar 端：交結果（落 transcript ＋ 結果 queue）
   */
  async publishResult(input) {
    const ts = Date.now();
    await this.opts.transcript.append({
      userId: this.opts.userId,
      requestId: input.requestId,
      role: "agent",
      kind: input.kind ?? "text",
      content: input.text,
      ts
    });
    await this.opts.tasks.put({
      requestId: input.requestId,
      userId: this.opts.userId,
      status: input.status,
      result: input.text,
      error: input.error,
      updatedAt: ts
    });
    await this.opts.resultsQueue.send(
      `${input.requestId}:${ts}`,
      JSON.stringify({ requestId: input.requestId, userId: this.opts.userId, ts })
    );
  }
  /**
   * App 端：拉結果（收到就 ack）
   */
  async pollResults(handler) {
    const messages = await this.opts.resultsQueue.poll(2e4, 10);
    for (const m of messages) {
      try {
        const payload = JSON.parse(m.body);
        await handler(payload);
      } catch {
      }
      await this.opts.resultsQueue.ack(m);
    }
  }
  /**
   * Sidecar 端：出確認卡（跨機：手機會見到呢張卡）
   */
  async publishConfirm(input) {
    const state = await this.opts.tasks.get(input.requestId);
    const sameCard = state?.confirm?.id === input.confirm?.id;
    await this.opts.tasks.put({
      requestId: input.requestId,
      userId: this.opts.userId,
      status: "awaiting_confirm",
      title: state?.title,
      result: state?.result,
      confirm: {
        ...input.confirm,
        decision: sameCard ? state?.confirm?.decision : void 0
      },
      updatedAt: Date.now()
    });
  }
  /** App 端：回覆確認卡（批／唔批） */
  async decideConfirm(requestId, approved) {
    const state = await this.opts.tasks.get(requestId);
    if (!state) throw new Error(`\u6435\u5514\u5230\u4EFB\u52D9 ${requestId}`);
    await this.opts.tasks.put({
      ...state,
      confirm: state.confirm ? { ...state.confirm, decision: approved ? "approved" : "cancelled" } : void 0,
      updatedAt: Date.now()
    });
  }
  /** App 端：查單一任務嘅狀態（手機輪詢結果就靠呢個） */
  async getTask(requestId) {
    return this.opts.tasks.get(requestId);
  }
  /** App 端：拉 transcript（增量） */
  async readTranscript(cursor, limit = 50) {
    return this.opts.transcript.read(this.opts.userId, cursor, limit);
  }
};

// src/aws.ts
import { DynamoDBClient, PutItemCommand, GetItemCommand, QueryCommand } from "@aws-sdk/client-dynamodb";
import { SQSClient, SendMessageCommand, ReceiveMessageCommand, DeleteMessageCommand } from "@aws-sdk/client-sqs";
var SqsQueue = class {
  constructor(queueUrl, region) {
    this.queueUrl = queueUrl;
    this.client = new SQSClient({ region });
  }
  client;
  async send(id, body) {
    await this.client.send(
      new SendMessageCommand({
        QueueUrl: this.queueUrl,
        MessageBody: body,
        MessageGroupId: void 0,
        MessageDeduplicationId: void 0,
        MessageAttributes: { relayId: { StringValue: id, DataType: "String" } }
      })
    );
  }
  async poll(waitTimeMs, max) {
    const res = await this.client.send(
      new ReceiveMessageCommand({
        QueueUrl: this.queueUrl,
        MaxNumberOfMessages: Math.min(10, max),
        WaitTimeSeconds: Math.min(20, Math.ceil(waitTimeMs / 1e3)),
        VisibilityTimeout: 30,
        MessageAttributeNames: ["All"]
      })
    );
    return (res.Messages ?? []).map((m) => ({
      id: m.MessageId ?? m.Attributes?.["SentTimestamp"] ?? "unknown",
      receiptHandle: m.ReceiptHandle,
      body: m.Body ?? "",
      receivedAt: Date.now()
    }));
  }
  async ack(message) {
    if (!message.receiptHandle) return;
    await this.client.send(
      new DeleteMessageCommand({
        QueueUrl: this.queueUrl,
        ReceiptHandle: message.receiptHandle
      })
    );
  }
};
var DynamoTranscriptStore = class {
  constructor(table, region) {
    this.table = table;
    this.client = new DynamoDBClient({ region });
  }
  client;
  async append(entry) {
    await this.client.send(
      new PutItemCommand({
        TableName: this.table,
        Item: {
          userId: { S: entry.userId },
          sortKey: { S: transcriptSortKey(entry) },
          requestId: { S: entry.requestId },
          role: { S: entry.role },
          kind: { S: entry.kind },
          content: { S: entry.content },
          ts: { N: String(entry.ts) }
        }
      })
    );
  }
  async read(userId, cursor, limit = 50) {
    const res = await this.client.send(
      new QueryCommand({
        TableName: this.table,
        KeyConditionExpression: "userId = :u",
        ExpressionAttributeValues: { ":u": { S: userId } },
        ScanIndexForward: true,
        Limit: limit,
        ExclusiveStartKey: cursor ? { userId: { S: userId }, sortKey: { S: cursor.replace(/:/g, "#") } } : void 0
      })
    );
    const entries = (res.Items ?? []).map((i) => ({
      userId: i.userId?.S ?? userId,
      requestId: i.requestId?.S ?? "",
      role: i.role?.S ?? "system",
      kind: i.kind?.S ?? "text",
      content: i.content?.S ?? "",
      ts: Number(i.ts?.N ?? 0)
    }));
    const last = entries[entries.length - 1];
    return {
      entries,
      cursor: last ? transcriptCursor(last) : cursor
    };
  }
};
var DynamoTaskStore = class {
  constructor(table, region) {
    this.table = table;
    this.client = new DynamoDBClient({ region });
  }
  client;
  async put(state) {
    const item = {
      requestId: { S: state.requestId },
      userId: { S: state.userId },
      status: { S: state.status },
      updatedAt: { N: String(state.updatedAt) }
    };
    if (state.title) item.title = { S: state.title };
    if (state.result) item.result = { S: state.result };
    if (state.error) item.error = { S: state.error };
    if (state.confirm) item.confirm = { S: JSON.stringify(state.confirm) };
    await this.client.send(new PutItemCommand({ TableName: this.table, Item: item }));
  }
  async get(requestId) {
    const res = await this.client.send(
      new GetItemCommand({ TableName: this.table, Key: { requestId: { S: requestId } } })
    );
    const i = res.Item;
    if (!i) return void 0;
    return {
      requestId: i.requestId?.S ?? requestId,
      userId: i.userId?.S ?? "",
      status: i.status?.S ?? "queued",
      title: i.title?.S,
      result: i.result?.S,
      error: i.error?.S,
      confirm: i.confirm?.S ? JSON.parse(i.confirm.S) : void 0,
      updatedAt: Number(i.updatedAt?.N ?? 0)
    };
  }
};
function createAwsQueues(opts) {
  return {
    tasksQueue: new SqsQueue(opts.tasksQueueUrl, opts.region),
    resultsQueue: new SqsQueue(opts.resultsQueueUrl, opts.region),
    transcript: new DynamoTranscriptStore(opts.transcriptTable, opts.region),
    tasks: new DynamoTaskStore(opts.taskTable, opts.region)
  };
}
export {
  DynamoTaskStore,
  DynamoTranscriptStore,
  RelayClient,
  SqsQueue,
  createAwsQueues,
  transcriptCursor,
  transcriptSortKey
};
