import type {
  AuditEntry,
  ConsoleLine,
  Message,
  RelayEntry,
  SessionInfo,
  Settings,
  Task,
} from "./store";

const ago = (ms: number) => new Date(Date.now() - ms).toISOString();

export const initialMessages: Message[] = [
  {
    id: "m-seed-1",
    role: "user",
    kind: "voice",
    text: "幫我寫封 email 俾客戶講明延遲兩日交付",
    ts: ago(1000 * 60 * 6),
    status: "delivered",
    requestId: "req-0001",
    hasAudio: true,
    sessionId: "s-1",
  },
  {
    id: "m-seed-2",
    role: "agent",
    kind: "text",
    text: "收到，我用 read-only 工具睇咗交付計劃，正整草稿…",
    ts: ago(1000 * 60 * 6 - 8000),
    requestId: "req-0001",
    sessionId: "s-1",
  },
];

export const initialTasks: Task[] = [
  {
    id: "task-0001",
    requestId: "req-0001",
    title: "寫 email 草稿：延期兩日交付",
    status: "completed",
    risk: "read_only",
    elapsed: "22 秒",
    result:
      "標題：關於交付日期調整（延遲 2 日）\n\n陳先生你好，\n\n就 〔專案名〕 原定交付日期，我們需要向你通知：因應最後一輪內部驗收，交付日期會順延 2 日至 〔新日期〕。功能範圍與合約條款不變，我們會喺新日期前提供最終驗收報告。\n\n如有任何調整需要，隨時同我講。\n\n祝好\n〔署名〕",
    createdAt: ago(1000 * 60 * 6),
  },
];

export const initialAudit: AuditEntry[] = [
  {
    id: "a-1",
    ts: ago(1000 * 60 * 7),
    tool: "delivery_plan.read",
    risk: "read_only",
    args: '{ file: "delivery-plan.md" }',
    result: "ok · 42 行",
  },
];

export const initialConsole: ConsoleLine[] = [
  {
    id: "c-1",
    ts: ago(1000 * 60 * 7),
    kind: "info",
    text: "sidecar boot · Pi SDK session ok · cwd=~/agent-workspace",
  },
  {
    id: "c-2",
    ts: ago(1000 * 60 * 6),
    kind: "relay",
    text: "[relay] task req-0001 delivered from app (device: iphone-15)",
  },
  {
    id: "c-3",
    ts: ago(1000 * 60 * 6 - 2000),
    kind: "tool",
    text: "[tool] delivery_plan.read(read_only) → ok",
  },
];

export const initialRelay: RelayEntry[] = [
  {
    id: "r-1",
    ts: ago(1000 * 60 * 6),
    dir: "in",
    detail: "req-0001 · 語音任務",
    state: "delivered",
  },
  {
    id: "r-2",
    ts: ago(1000 * 60 * 6 - 3000),
    dir: "out",
    detail: "req-0001 · 任務結果",
    state: "delivered",
  },
];

export const initialSessions: SessionInfo[] = [
  {
    id: "s-1",
    title: "客戶跟進",
    startedAt: ago(1000 * 60 * 60 * 2),
    messages: 14,
    state: "idle",
  },
  {
    id: "s-2",
    title: "本週交付摘要",
    startedAt: ago(1000 * 60 * 60 * 26),
    messages: 6,
    state: "idle",
  },
];

export const initialSettings: Settings = {
  stt: true,
  tts: true,
  quiet: false,
  push: true,
};
