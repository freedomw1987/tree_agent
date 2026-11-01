import type { Queue, TaskState, TaskStore, TranscriptEntry, TranscriptStore } from "./types";

/**
 * M02 relay client —— App 端同 Sidecar 端共用嘅中轉邏輯
 *
 * 規則（來自 SPIKE-001 定案）：
 *  - 傳輸 = SQS long-poll（App → tasks queue → Sidecar；Sidecar → results queue → App）
 *  - 冪等 = request_id（同一個 request 重試唔會重複執行）
 *  - Transcript = DynamoDB（partition user_id；sort ts#request_id）
 *
 * 呢層唔識 AWS（用 Queue / TranscriptStore 介面）→ 可以用 fake 測試，
 * 真實接線喺 aws.ts。
 */

export interface RelayOptions {
  userId: string;
  tasksQueue: Queue;
  resultsQueue: Queue;
  transcript: TranscriptStore;
  tasks: TaskStore;
  /** 產生 request id（測試可以注入固定值） */
  newRequestId?: () => string;
}

export interface SendTaskInput {
  text: string;
  kind?: TranscriptEntry["kind"];
  requestId?: string;
  title?: string;
}

export class RelayClient {
  private readonly opts: RelayOptions;

  constructor(opts: RelayOptions) {
    this.opts = opts;
  }

  private makeRequestId(): string {
    if (this.opts.newRequestId) return this.opts.newRequestId();
    return `req-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  }

  /**
   * App 端：派任務
   *  - 冪等：同 requestId 重試 → 只入庫一次、只入隊一次
   *  - 回傳 requestId（之後用嚟對結果）
   */
  async sendTask(input: SendTaskInput): Promise<string> {
    const requestId = input.requestId ?? this.makeRequestId();
    const ts = Date.now();

    const existing = await this.opts.tasks.get(requestId);
    if (existing) return requestId; // 冪等：已派過就唔好再派

    await this.opts.transcript.append({
      userId: this.opts.userId,
      requestId,
      role: "user",
      kind: input.kind ?? "text",
      content: input.text,
      ts,
    });

    await this.opts.tasks.put({
      requestId,
      userId: this.opts.userId,
      status: "queued",
      title: input.title ?? input.text.slice(0, 24),
      updatedAt: ts,
    });

    await this.opts.tasksQueue.send(
      requestId,
      JSON.stringify({ requestId, userId: this.opts.userId, text: input.text, ts }),
    );

    return requestId;
  }

  /**
   * Sidecar 端：長輪詢攞任務
   *  - 收到即 ack（避免重複投遞；真實世界要喺處理完先 ack → 見 TODO）
   */
  async pollTasks(handler: (task: { requestId: string; userId: string; text: string; ts: number }) => Promise<void> | void): Promise<void> {
    const messages = await this.opts.tasksQueue.poll(20000, 10);
    for (const m of messages) {
      let payload: { requestId: string; userId: string; text: string; ts: number };
      try {
        payload = JSON.parse(m.body);
      } catch {
        await this.opts.tasksQueue.ack(m);
        continue; // 壞 payload：丟棄（但唔阻其他訊息）
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
  async pollTasksConcurrent(
    handler: (task: { requestId: string; userId: string; text: string; ts: number }) => Promise<void> | void,
  ): Promise<void> {
    const messages = await this.opts.tasksQueue.poll(20000, 10);
    for (const m of messages) {
      let payload: { requestId: string; userId: string; text: string; ts: number };
      try {
        payload = JSON.parse(m.body);
      } catch {
        await this.opts.tasksQueue.ack(m);
        continue;
      }
      // 背景處理：每個訊息自己 ack（唔阻塞其它任務）
      void (async () => {
        try {
          await handler(payload);
        } catch {
          /* handler 自己處理錯誤 */
        } finally {
          await this.opts.tasksQueue.ack(m);
        }
      })();
    }
  }

  /**
   * Sidecar 端：交結果（落 transcript ＋ 結果 queue）
   */
  async publishResult(input: {
    requestId: string;
    text: string;
    status: TaskState["status"];
    kind?: TranscriptEntry["kind"];
    error?: string;
  }): Promise<void> {
    const ts = Date.now();
    await this.opts.transcript.append({
      userId: this.opts.userId,
      requestId: input.requestId,
      role: "agent",
      kind: input.kind ?? "text",
      content: input.text,
      ts,
    });
    await this.opts.tasks.put({
      requestId: input.requestId,
      userId: this.opts.userId,
      status: input.status,
      result: input.text,
      error: input.error,
      updatedAt: ts,
    });
    await this.opts.resultsQueue.send(
      `${input.requestId}:${ts}`,
      JSON.stringify({ requestId: input.requestId, userId: this.opts.userId, ts }),
    );
  }

  /**
   * App 端：拉結果（收到就 ack）
   */
  async pollResults(handler: (r: { requestId: string; ts: number }) => Promise<void> | void): Promise<void> {
    const messages = await this.opts.resultsQueue.poll(20000, 10);
    for (const m of messages) {
      try {
        const payload = JSON.parse(m.body) as { requestId: string; ts: number };
        await handler(payload);
      } catch {
        /* 壞 payload：跳過 */
      }
      await this.opts.resultsQueue.ack(m);
    }
  }

  /**
   * Sidecar 端：出確認卡（跨機：手機會見到呢張卡）
   */
  async publishConfirm(input: {
    requestId: string;
    confirm: TaskState["confirm"];
  }): Promise<void> {
    const state = await this.opts.tasks.get(input.requestId);
    // ⚠️ 同一張卡要保留用戶已經做咗嘅決定（Agent 再調工具會出新卡，唔可以清咗舊決定）
    const sameCard = state?.confirm?.id === input.confirm?.id;
    await this.opts.tasks.put({
      requestId: input.requestId,
      userId: this.opts.userId,
      status: "awaiting_confirm",
      title: state?.title,
      result: state?.result,
      confirm: {
        ...(input.confirm as NonNullable<TaskState["confirm"]>),
        decision: sameCard ? state?.confirm?.decision : undefined,
      },
      updatedAt: Date.now(),
    });
  }

  /** App 端：回覆確認卡（批／唔批） */
  async decideConfirm(requestId: string, approved: boolean): Promise<void> {
    const state = await this.opts.tasks.get(requestId);
    if (!state) throw new Error(`搵唔到任務 ${requestId}`);
    await this.opts.tasks.put({
      ...state,
      confirm: state.confirm
        ? { ...state.confirm, decision: approved ? "approved" : "cancelled" }
        : undefined,
      updatedAt: Date.now(),
    });
  }

  /** App 端：查單一任務嘅狀態（手機輪詢結果就靠呢個） */
  async getTask(requestId: string): Promise<TaskState | undefined> {
    return this.opts.tasks.get(requestId);
  }

  /** App 端：拉 transcript（增量） */
  async readTranscript(cursor?: string, limit = 50) {
    return this.opts.transcript.read(this.opts.userId, cursor, limit);
  }
}
