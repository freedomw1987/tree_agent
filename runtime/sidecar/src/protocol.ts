/**
 * Sidecar IPC 協議（Rust/Tauri ↔ Node sidecar，stdio JSON lines）
 *
 * 方向：
 *   Rust → Node：Request  { type: "prompt" | "status" | "shutdown" | "switch_session" | "fork" , ... }
 *   Node → Rust：Message  { type: "ready" | "chunk" | "done" | "error" | "log", ... }
 *
 * 設計重點：
 *  - 逐行 JSON（\n 分隔），一行一個訊息 → 易 debug、易測試、易喺 Rust 端 parse
 *  - 每個 request 有 id → 回應可以對返邊個請求（streaming 要用到）
 *  - 壞行唔會炸成個 host：parse 失敗 → 回 error + 繼續行（fail-loud 但唔 fatal）
 */

export type RequestType =
  | "prompt"
  | "status"
  | "shutdown"
  | "switch_session"
  | "fork"
  | "new_session"
  | "confirm_response"
  | "list_tools"
  | "audit_log";

export interface Request {
  type: RequestType;
  /** request 唯一 id（回應要對返） */
  id?: string;
  /** prompt 內容 */
  text?: string;
  /** session 相關操作嘅目標 session id */
  sessionId?: string;
  /** 新 session 名（可選，冇就自動命名） */
  title?: string;
  /** confirm_response：批唔批（id = 確認卡 id） */
  approved?: boolean;
  /** confirm_response：確認卡 id */
  confirmId?: string;
}

export type MessageType =
  | "ready"
  | "chunk"
  | "done"
  | "partial"
  | "error"
  | "log"
  | "confirm_request";

export interface Message {
  type: MessageType;
  id?: string;
  /** chunk：增量文字；done：全文 */
  text?: string;
  /** error：人睇嘅訊息（要講得出點解錯、點修） */
  message?: string;
  /** partial：任務被中止（超預算）—— 有部分結果 */
  reason?: string;
  /** ready：session 資訊 */
  sessionId?: string;
  sessionTitle?: string;
  workspace?: string;
  /** log：sidecar 內部事件（relay 送達、工具調用…） */
  event?: string;
  /** confirm_request：要前端出確認卡 */
  toolName?: string;
  toolLabel?: string;
  riskLevel?: "read_only" | "write" | "external_effect";
  /** 確認卡預覽（diff / payload） */
  preview?: string;
  /** 確認卡過期時間（epoch ms） */
  expiresAt?: number;
  /** 任意結構化資料（工具清單 / audit log 等） */
  data?: unknown;
}

export class ProtocolError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProtocolError";
  }
}

/** 解析一行 → Request；唔合法就 throw ProtocolError（host 負責回 error 兼繼續） */
export function parseRequest(line: string): Request {
  const trimmed = line.trim();
  if (!trimmed) throw new ProtocolError("空白行唔係有效 request");
  let raw: unknown;
  try {
    raw = JSON.parse(trimmed);
  } catch {
    throw new ProtocolError(`唔係合法 JSON：${trimmed.slice(0, 80)}`);
  }
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    throw new ProtocolError("request 必須係 JSON object");
  }
  const obj = raw as Record<string, unknown>;
  const type = obj.type;
  const valid: RequestType[] = [
    "prompt",
    "status",
    "shutdown",
    "switch_session",
    "fork",
    "new_session",
    "confirm_response",
    "list_tools",
    "audit_log",
  ];
  if (typeof type !== "string" || !valid.includes(type as RequestType)) {
    throw new ProtocolError(`未知 request type：${String(type)}`);
  }
  return obj as unknown as Request;
}

/** Request → 一行 JSON */
export function serializeRequest(req: Request): string {
  return JSON.stringify(req);
}

/** Message → 一行 JSON */
export function serializeMessage(msg: Message): string {
  return JSON.stringify(msg);
}

/** 解析一行 → Message */
export function parseMessage(line: string): Message {
  const trimmed = line.trim();
  if (!trimmed) throw new ProtocolError("空白行唔係有效 message");
  let raw: unknown;
  try {
    raw = JSON.parse(trimmed);
  } catch {
    throw new ProtocolError(`唔係合法 JSON：${trimmed.slice(0, 80)}`);
  }
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    throw new ProtocolError("message 必須係 JSON object");
  }
  return raw as Message;
}
