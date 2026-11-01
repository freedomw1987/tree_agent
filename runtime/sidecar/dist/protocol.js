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
export class ProtocolError extends Error {
    constructor(message) {
        super(message);
        this.name = "ProtocolError";
    }
}
/** 解析一行 → Request；唔合法就 throw ProtocolError（host 負責回 error 兼繼續） */
export function parseRequest(line) {
    const trimmed = line.trim();
    if (!trimmed)
        throw new ProtocolError("空白行唔係有效 request");
    let raw;
    try {
        raw = JSON.parse(trimmed);
    }
    catch {
        throw new ProtocolError(`唔係合法 JSON：${trimmed.slice(0, 80)}`);
    }
    if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
        throw new ProtocolError("request 必須係 JSON object");
    }
    const obj = raw;
    const type = obj.type;
    const valid = [
        "prompt",
        "status",
        "shutdown",
        "switch_session",
        "fork",
        "new_session",
    ];
    if (typeof type !== "string" || !valid.includes(type)) {
        throw new ProtocolError(`未知 request type：${String(type)}`);
    }
    return obj;
}
/** Request → 一行 JSON */
export function serializeRequest(req) {
    return JSON.stringify(req);
}
/** Message → 一行 JSON */
export function serializeMessage(msg) {
    return JSON.stringify(msg);
}
/** 解析一行 → Message */
export function parseMessage(line) {
    const trimmed = line.trim();
    if (!trimmed)
        throw new ProtocolError("空白行唔係有效 message");
    let raw;
    try {
        raw = JSON.parse(trimmed);
    }
    catch {
        throw new ProtocolError(`唔係合法 JSON：${trimmed.slice(0, 80)}`);
    }
    if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
        throw new ProtocolError("message 必須係 JSON object");
    }
    return raw;
}
