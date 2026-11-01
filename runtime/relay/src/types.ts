/** M02 relay 嘅抽象（用嚟隔離 AWS，方便 TDD ＋ 之後換 transport） */

export interface QueueMessage {
  /** 邏輯 id（去重用；SQS 係 MessageId） */
  id: string;
  /** ack 用嘅句柄（SQS = ReceiptHandle；唔同 queue 可能唔同 → 做成可選） */
  receiptHandle?: string;
  body: string;
  /** 收到時間（epoch ms） */
  receivedAt: number;
}

export interface Queue {
  send(id: string, body: string): Promise<void>;
  /** 長輪詢取件（waitTimeMs 內冇就回空陣列） */
  poll(waitTimeMs: number, max: number): Promise<QueueMessage[]>;
  /** 刪除／確認已處理（避免重複投遞）—— SQS 要用 ReceiptHandle，唔係 MessageId */
  ack(message: QueueMessage): Promise<void>;
}

export interface TranscriptEntry {
  userId: string;
  requestId: string;
  role: "user" | "agent" | "system";
  kind: "text" | "voice" | "task" | "confirm";
  content: string;
  ts: number;
}

/**
 * transcript 嘅 sort key / cursor
 * ⚠️ 必須包埋 role：同一毫秒內同一 requestId 會有 user + agent 兩條，
 *    淨係用 ts#requestId 會撞 key → 增量拉取會漏條（實測踩過）
 */
export function transcriptSortKey(e: TranscriptEntry): string {
  return `${e.ts}#${e.requestId}#${e.role}`;
}

export function transcriptCursor(e: TranscriptEntry): string {
  return `${e.ts}:${e.requestId}:${e.role}`;
}

export interface TranscriptStore {
  /** 寫入（冪等：同 requestId 唔會寫兩次） */
  append(entry: TranscriptEntry): Promise<void>;
  /** 增量讀取（cursor 之後） */
  read(userId: string, cursor?: string, limit?: number): Promise<{ entries: TranscriptEntry[]; cursor?: string }>;
}

export interface TaskState {
  requestId: string;
  userId: string;
  status: "queued" | "running" | "awaiting_confirm" | "completed" | "failed" | "partial";
  title?: string;
  result?: string;
  error?: string;
  updatedAt: number;
}

export interface TaskStore {
  put(state: TaskState): Promise<void>;
  get(requestId: string): Promise<TaskState | undefined>;
}
