import { DynamoDBClient, PutItemCommand, GetItemCommand, QueryCommand } from "@aws-sdk/client-dynamodb";
import { SQSClient, SendMessageCommand, ReceiveMessageCommand, DeleteMessageCommand } from "@aws-sdk/client-sqs";
import { transcriptSortKey, transcriptCursor } from "./types";
import type { Queue, QueueMessage, TaskState, TaskStore, TranscriptEntry, TranscriptStore } from "./types";

/**
 * M02 真實 AWS 接線（SQS long-poll ＋ DynamoDB）
 * ⚠️ 呢層唔用喺 unit test（要用 fake）；喺集成驗證（真 AWS）先用。
 */

export interface AwsOptions {
  region: string;
  tasksQueueUrl: string;
  resultsQueueUrl: string;
  transcriptTable: string;
  taskTable: string;
  userId: string;
}

export class SqsQueue implements Queue {
  private readonly client: SQSClient;

  constructor(
    private readonly queueUrl: string,
    region: string,
  ) {
    this.client = new SQSClient({ region });
  }

  async send(id: string, body: string): Promise<void> {
    await this.client.send(
      new SendMessageCommand({
        QueueUrl: this.queueUrl,
        MessageBody: body,
        MessageGroupId: undefined,
        MessageDeduplicationId: undefined,
        MessageAttributes: { relayId: { StringValue: id, DataType: "String" } },
      }),
    );
  }

  async poll(waitTimeMs: number, max: number): Promise<QueueMessage[]> {
    const res = await this.client.send(
      new ReceiveMessageCommand({
        QueueUrl: this.queueUrl,
        MaxNumberOfMessages: Math.min(10, max),
        WaitTimeSeconds: Math.min(20, Math.ceil(waitTimeMs / 1000)),
        VisibilityTimeout: 30,
        MessageAttributeNames: ["All"],
      }),
    );
    return (res.Messages ?? []).map((m) => ({
      id: m.MessageId ?? m.Attributes?.["SentTimestamp"] ?? "unknown",
      receiptHandle: m.ReceiptHandle,
      body: m.Body ?? "",
      receivedAt: Date.now(),
    }));
  }

  async ack(message: QueueMessage): Promise<void> {
    // ⚠️ SQS 一定要用 ReceiptHandle（用 MessageId 會 ReceiptHandleIsInvalid）
    if (!message.receiptHandle) return;
    await this.client.send(
      new DeleteMessageCommand({
        QueueUrl: this.queueUrl,
        ReceiptHandle: message.receiptHandle,
      }),
    );
  }
}

export class DynamoTranscriptStore implements TranscriptStore {
  private readonly client: DynamoDBClient;

  constructor(
    private readonly table: string,
    region: string,
  ) {
    this.client = new DynamoDBClient({ region });
  }

  async append(entry: TranscriptEntry): Promise<void> {
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
          ts: { N: String(entry.ts) },
        },
      }),
    );
  }

  async read(userId: string, cursor?: string, limit = 50) {
    const res = await this.client.send(
      new QueryCommand({
        TableName: this.table,
        KeyConditionExpression: "userId = :u",
        ExpressionAttributeValues: { ":u": { S: userId } },
        ScanIndexForward: true,
        Limit: limit,
        ExclusiveStartKey: cursor
          ? { userId: { S: userId }, sortKey: { S: cursor.replace(/:/g, "#") } }
          : undefined,
      }),
    );
    const entries: TranscriptEntry[] = (res.Items ?? []).map((i) => ({
      userId: i.userId?.S ?? userId,
      requestId: i.requestId?.S ?? "",
      role: (i.role?.S ?? "system") as TranscriptEntry["role"],
      kind: (i.kind?.S ?? "text") as TranscriptEntry["kind"],
      content: i.content?.S ?? "",
      ts: Number(i.ts?.N ?? 0),
    }));
    const last = entries[entries.length - 1];
    return {
      entries,
      cursor: last ? transcriptCursor(last) : cursor,
    };
  }
}

export class DynamoTaskStore implements TaskStore {
  private readonly client: DynamoDBClient;

  constructor(
    private readonly table: string,
    region: string,
  ) {
    this.client = new DynamoDBClient({ region });
  }

  async put(state: TaskState): Promise<void> {
    const item: Record<string, { S: string } | { N: string }> = {
      requestId: { S: state.requestId },
      userId: { S: state.userId },
      status: { S: state.status },
      updatedAt: { N: String(state.updatedAt) },
    };
    if (state.title) item.title = { S: state.title };
    if (state.result) item.result = { S: state.result };
    if (state.error) item.error = { S: state.error };
    await this.client.send(new PutItemCommand({ TableName: this.table, Item: item }));
  }

  async get(requestId: string): Promise<TaskState | undefined> {
    const res = await this.client.send(
      new GetItemCommand({ TableName: this.table, Key: { requestId: { S: requestId } } }),
    );
    const i = res.Item;
    if (!i) return undefined;
    return {
      requestId: i.requestId?.S ?? requestId,
      userId: i.userId?.S ?? "",
      status: (i.status?.S ?? "queued") as TaskState["status"],
      title: i.title?.S,
      result: i.result?.S,
      error: i.error?.S,
      updatedAt: Number(i.updatedAt?.N ?? 0),
    };
  }
}

export function createAwsQueues(opts: AwsOptions) {
  return {
    tasksQueue: new SqsQueue(opts.tasksQueueUrl, opts.region),
    resultsQueue: new SqsQueue(opts.resultsQueueUrl, opts.region),
    transcript: new DynamoTranscriptStore(opts.transcriptTable, opts.region),
    tasks: new DynamoTaskStore(opts.taskTable, opts.region),
  };
}
