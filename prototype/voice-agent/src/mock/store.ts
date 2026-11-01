import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  initialAudit,
  initialConsole,
  initialMessages,
  initialRelay,
  initialSessions,
  initialSettings,
  initialTasks,
} from "./db";

export type RiskLevel = "read_only" | "write" | "external_effect";
export type DemoMode = "happy" | "loading" | "empty" | "error" | "edge";
export type AgentStatus = "ready" | "busy" | "offline";
export type TaskStatus =
  | "queued"
  | "running"
  | "awaiting_confirm"
  | "completed"
  | "failed"
  | "partial";

export interface Message {
  id: string;
  role: "user" | "agent" | "system";
  kind: "text" | "voice" | "task" | "confirm";
  text: string;
  ts: string;
  status?: "sending" | "sent" | "delivered" | "failed";
  requestId?: string;
  taskId?: string;
  hasAudio?: boolean;
  sessionId?: string;
}

export interface Task {
  id: string;
  requestId: string;
  title: string;
  status: TaskStatus;
  risk?: RiskLevel;
  elapsed?: string;
  result?: string;
  error?: string;
  createdAt: string;
}

export interface ConfirmRequest {
  id: string;
  taskId: string;
  tool: string;
  risk: RiskLevel;
  preview: string;
  expiresAt: number;
}

export interface AuditEntry {
  id: string;
  ts: string;
  tool: string;
  risk: RiskLevel;
  args: string;
  result: string;
}

export interface ConsoleLine {
  id: string;
  ts: string;
  kind: "relay" | "stream" | "tool" | "blocked" | "error" | "info";
  text: string;
}

export interface RelayEntry {
  id: string;
  ts: string;
  dir: "in" | "out";
  detail: string;
  state: "queued" | "delivered" | "deduped" | "error";
}

export interface SessionInfo {
  id: string;
  title: string;
  startedAt: string;
  messages: number;
  state: "active" | "idle" | "broken";
  /** true = 由「自動分流」開出嚟（唔係人手開） */
  auto?: boolean;
}

export interface Settings {
  stt: boolean;
  tts: boolean;
  quiet: boolean;
  push: boolean;
}

interface DemoState {
  messages: Message[];
  tasks: Task[];
  confirm: ConfirmRequest | null;
  audit: AuditEntry[];
  consoleLines: ConsoleLine[];
  relay: RelayEntry[];
  sessions: SessionInfo[];
  currentSessionId: string;
  sessionSheetOpen: boolean;
  agentStatus: AgentStatus;
  workspace: string;
  settings: Settings;
  demoMode: DemoMode;
  step: number;
  sttDraft: string | null;
  recording: boolean;
  notify: { id: string; title: string; body: string; audio: boolean } | null;

  setDemoMode: (m: DemoMode) => void;
  setStep: (s: number) => void;
  setRecording: (v: boolean) => void;
  setSttDraft: (v: string | null) => void;
  setWorkspace: (w: string) => void;
  updateSettings: (p: Partial<Settings>) => void;
  setAgentStatus: (s: AgentStatus) => void;
  dismissNotify: () => void;
  openSessionSheet: () => void;
  closeSessionSheet: () => void;
  switchSession: (id: string) => void;
  startNewSession: (title?: string) => void;

  sendMessage: (text: string, opts?: { voice?: boolean; title?: string }) => void;
  requestConfirm: () => void;
  approveConfirm: () => void;
  cancelConfirm: () => void;
  failLastTask: () => void;
  completeLastTask: () => void;
  reset: () => void;
}

const now = () => new Date().toISOString();
let seq = 0;
const id = (p: string) => `${p}-${Date.now().toString(36)}-${(seq += 1)}`;

/**
 * 自動分流（M04/M03 決策）：由訊息內容猜返屬於邊個 session。
 * 命中規則 → 續返嗰條 session；冇命中 → 開新（自動命名）。
 * （demo 用簡化關鍵詞規則；真實版由 Agent 判斷。）
 */
export function routeSession(text: string, sessions: SessionInfo[]): SessionInfo {
  const rules: { re: RegExp; title: string }[] = [
    { re: /客戶|客|報價|email|郵件/i, title: "客戶跟進" },
    { re: /交付|摘要|進度|週報|總結/i, title: "本週交付摘要" },
  ];
  for (const r of rules) {
    if (r.re.test(text)) {
      const hit = sessions.find((s) => s.title === r.title);
      if (hit) return hit;
      return {
        id: id("s"),
        title: r.title,
        startedAt: now(),
        messages: 0,
        state: "idle",
        auto: true,
      };
    }
  }
  const current = sessions.find((s) => s.id === sessions[0]?.id) ?? sessions[0];
  return (
    current ?? {
      id: id("s"),
      title: "新對話",
      startedAt: now(),
      messages: 0,
      state: "idle",
      auto: true,
    }
  );
}

export const useDemoStore = create<DemoState>()(
  persist(
    (set, get) => ({
      messages: initialMessages,
      tasks: initialTasks,
      confirm: null,
      audit: initialAudit,
      consoleLines: initialConsole,
      relay: initialRelay,
      sessions: initialSessions,
      currentSessionId: initialSessions[0].id,
      sessionSheetOpen: false,
      agentStatus: "ready",
      workspace: "~/agent-workspace",
      settings: initialSettings,
      demoMode: "happy",
      step: 0,
      sttDraft: null,
      recording: false,
      notify: null,

      setDemoMode: (demoMode) => set({ demoMode }),
      setStep: (step) => set({ step }),
      setRecording: (recording) => set({ recording }),
      setSttDraft: (sttDraft) => set({ sttDraft }),
      setWorkspace: (workspace) => set({ workspace }),
      updateSettings: (p) => set((s) => ({ settings: { ...s.settings, ...p } })),
      setAgentStatus: (agentStatus) => set({ agentStatus }),
      dismissNotify: () => set({ notify: null }),
      openSessionSheet: () => set({ sessionSheetOpen: true }),
      closeSessionSheet: () => set({ sessionSheetOpen: false }),
      switchSession: (currentSessionId) => set({ currentSessionId, sessionSheetOpen: false }),
      startNewSession: (title) => {
        const s: SessionInfo = {
          id: id("s"),
          title: title ?? "新對話",
          startedAt: now(),
          messages: 0,
          state: "idle",
        };
        set((st) => ({
          sessions: [s, ...st.sessions],
          currentSessionId: s.id,
          sessionSheetOpen: false,
        }));
      },

      sendMessage: (text, opts) => {
        const { demoMode, agentStatus } = get();
        if (agentStatus === "offline") return;

        const requestId = id("req");
        const taskId = id("task");
        const ts = now();

        // 自動分流：續返對應 session 嘅話繼續，冇對應就開新（自動命名）
        const target = routeSession(text, get().sessions);
        const known = get().sessions.some((s) => s.id === target.id);
        if (!known) {
          set((s) => ({ sessions: [target, ...s.sessions] }));
        }
        set({ currentSessionId: target.id });

        const userMsg: Message = {
          id: id("m"),
          role: "user",
          kind: opts?.voice ? "voice" : "text",
          text,
          ts,
          status: "sending",
          requestId,
          taskId,
          hasAudio: opts?.voice,
          sessionId: target.id,
        };

        set((s) => ({
          messages: [...s.messages, userMsg],
          sessions: s.sessions.map((x) =>
            x.id === target.id ? { ...x, messages: x.messages + 1 } : x,
          ),
          tasks: [
            ...s.tasks,
            {
              id: taskId,
              requestId,
              title: opts?.title ?? text.slice(0, 24),
              status: "queued",
              createdAt: ts,
            },
          ],
          agentStatus: "busy",
        }));

        // error 模式：訊息送唔到
        if (demoMode === "error") {
          setTimeout(() => {
            set((s) => ({
              messages: s.messages.map((m) =>
                m.id === userMsg.id ? { ...m, status: "failed" as const } : m,
              ),
              tasks: s.tasks.map((t) =>
                t.id === taskId
                  ? {
                      ...t,
                      status: "failed" as const,
                      error: "連唔到 Relay（逾時 5 秒）—— 檢查網絡或者 AWS 區域設定，再撳重試。",
                    }
                  : t,
              ),
              agentStatus: "ready" as const,
              consoleLines: [
                ...s.consoleLines,
                {
                  id: id("c"),
                  ts: now(),
                  kind: "error" as const,
                  text: "[error] relay timeout · request_id deduped, task not dispatched",
                },
              ],
              relay: [
                ...s.relay,
                {
                  id: id("r"),
                  ts: now(),
                  dir: "in" as const,
                  detail: `${requestId} · 逾時`,
                  state: "error" as const,
                },
              ],
            }));
          }, 700);
          return;
        }

        // 正常路徑：sending → delivered → running → completed
        setTimeout(() => {
          set((s) => ({
            messages: s.messages.map((m) =>
              m.id === userMsg.id ? { ...m, status: "delivered" as const } : m,
            ),
            tasks: s.tasks.map((t) =>
              t.id === taskId ? { ...t, status: "running" as const } : t,
            ),
            relay: [
              ...s.relay,
              {
                id: id("r"),
                ts: now(),
                dir: "in" as const,
                detail: `${requestId} · 已送達 sidecar`,
                state: "delivered" as const,
              },
            ],
            consoleLines: [
              ...s.consoleLines,
              {
                id: id("c"),
                ts: now(),
                kind: "relay" as const,
                text: `[relay] task ${requestId} delivered from app`,
              },
              {
                id: id("c"),
                ts: now(),
                kind: "stream" as const,
                text: "agent › 收到，我開始做…",
              },
            ],
          }));
        }, 500);

        setTimeout(() => {
          set((s) => {
            const result = `已完成「${opts?.title ?? text.slice(0, 20)}」。\n\n交付物：\n· 重點摘要（3 點）\n· 建議下一步\n\n要唔要我幫你出埋一份可以直接發出去嘅版本？`;
            return {
              messages: [
                ...s.messages,
                {
                  id: id("m"),
                  role: "agent" as const,
                  kind: "text" as const,
                  text: "搞掂咗，交付物喺下面 👇（語音回覆可用）",
                  ts: now(),
                  requestId,
                  taskId,
                  hasAudio: true,
                },
              ],
              tasks: s.tasks.map((t) =>
                t.id === taskId
                  ? { ...t, status: "completed" as const, elapsed: "24 秒", result }
                  : t,
              ),
              agentStatus: "ready" as const,
              consoleLines: [
                ...s.consoleLines,
                {
                  id: id("c"),
                  ts: now(),
                  kind: "stream" as const,
                  text: "agent › 任務完成 · 交付物已寫入 transcript",
                },
              ],
              relay: [
                ...s.relay,
                {
                  id: id("r"),
                  ts: now(),
                  dir: "out" as const,
                  detail: `${requestId} · 任務結果`,
                  state: "delivered" as const,
                },
              ],
              notify: get().settings.push
                ? {
                    id: id("n"),
                    title: "任務完成",
                    body: `「${opts?.title ?? text.slice(0, 20)}」已經搞掂`,
                    audio: true,
                  }
                : null,
            };
          });
        }, 1600);
      },

      requestConfirm: () => {
        const { tasks, agentStatus } = get();
        if (agentStatus === "offline") return;
        const last = [...tasks].reverse().find((t) => t.status !== "awaiting_confirm");
        const taskId = last?.id ?? id("task");
        const requestId = last?.requestId ?? id("req");
        const confirm: ConfirmRequest = {
          id: id("cf"),
          taskId,
          tool: "workspace.write_file",
          risk: "write",
          preview:
            "--- a/delivery-plan.md\n+++ b/delivery-plan.md\n@@ -12,7 +12,7 @@\n-  交付日期：2026-11-05\n+  交付日期：2026-11-07\n",
          expiresAt: Date.now() + 5 * 60 * 1000,
        };
        set((s) => ({
          confirm,
          agentStatus: "busy",
          tasks: s.tasks.some((t) => t.id === taskId)
            ? s.tasks.map((t) =>
                t.id === taskId
                  ? { ...t, status: "awaiting_confirm" as const, risk: "write" as const }
                  : t,
              )
            : [
                ...s.tasks,
                {
                  id: taskId,
                  requestId,
                  title: "改交付日期（delivery-plan.md）",
                  status: "awaiting_confirm",
                  risk: "write",
                  createdAt: now(),
                },
              ],
          messages: [
            ...s.messages,
            {
              id: id("m"),
              role: "agent" as const,
              kind: "text" as const,
              text: "我要改一個檔案（交付計劃），想確認先改：",
              ts: now(),
              requestId,
              taskId,
            },
          ],
          consoleLines: [
            ...s.consoleLines,
            {
              id: id("c"),
              ts: now(),
              kind: "blocked" as const,
              text: "[blocked] workspace.write_file(risk=write) → 等緊確認",
            },
          ],
        }));
      },

      approveConfirm: () => {
        const { confirm } = get();
        if (!confirm) return;
        set((s) => ({
          confirm: null,
          agentStatus: "ready",
          tasks: s.tasks.map((t) =>
            t.id === confirm.taskId
              ? {
                  ...t,
                  status: "completed" as const,
                  elapsed: "9 秒",
                  result: "已更新 delivery-plan.md：交付日期 2026-11-05 → 2026-11-07",
                }
              : t,
          ),
          messages: [
            ...s.messages,
            {
              id: id("m"),
              role: "agent" as const,
              kind: "text" as const,
              text: "改咗 ✅ delivery-plan.md 已更新（2026-11-05 → 2026-11-07）",
              ts: now(),
              taskId: confirm.taskId,
            },
          ],
          audit: [
            ...s.audit,
            {
              id: id("a"),
              ts: now(),
              tool: confirm.tool,
              risk: confirm.risk,
              args: "{ file: \"delivery-plan.md\", approvedBy: \"user\" }",
              result: "ok · 1 行改動",
            },
          ],
          consoleLines: [
            ...s.consoleLines,
            {
              id: id("c"),
              ts: now(),
              kind: "tool" as const,
              text: "[tool] workspace.write_file(write) → approved by user → ok",
            },
          ],
        }));
      },

      cancelConfirm: () => {
        const { confirm } = get();
        if (!confirm) return;
        set((s) => ({
          confirm: null,
          agentStatus: "ready",
          tasks: s.tasks.map((t) =>
            t.id === confirm.taskId ? { ...t, status: "failed" as const, error: "用戶取消咗（唔會自動重試）" } : t,
          ),
          messages: [
            ...s.messages,
            {
              id: id("m"),
              role: "agent" as const,
              kind: "text" as const,
              text: "好，唔改。",
              ts: now(),
              taskId: confirm.taskId,
            },
          ],
          consoleLines: [
            ...s.consoleLines,
            {
              id: id("c"),
              ts: now(),
              kind: "blocked" as const,
              text: "[blocked] workspace.write_file → cancelled by user",
            },
          ],
        }));
      },

      failLastTask: () => {
        set((s) => {
          const last = [...s.tasks].reverse().find((t) => t.status === "completed");
          if (!last) return {};
          return {
            tasks: s.tasks.map((t) =>
              t.id === last.id
                ? {
                    ...t,
                    status: "failed" as const,
                    error: "工具拋錯：delivery_plan.read 讀唔到檔案（路徑已被改名）—— 確認 Workspace 路徑先再試。",
                  }
                : t,
            ),
          };
        });
      },

      completeLastTask: () => {
        set((s) => {
          const last = [...s.tasks].reverse().find((t) => t.status === "running");
          if (!last) return {};
          return {
            tasks: s.tasks.map((t) =>
              t.id === last.id ? { ...t, status: "completed" as const, elapsed: "24 秒" } : t,
            ),
            agentStatus: "ready" as const,
          };
        });
      },

      reset: () =>
        set({
          messages: initialMessages,
          tasks: initialTasks,
          confirm: null,
          audit: initialAudit,
          consoleLines: initialConsole,
          relay: initialRelay,
          sessions: initialSessions,
          currentSessionId: initialSessions[0].id,
          sessionSheetOpen: false,
          agentStatus: "ready",
          workspace: "~/agent-workspace",
          settings: initialSettings,
          demoMode: "happy",
          step: 0,
          sttDraft: null,
          recording: false,
          notify: null,
        }),
    }),
    {
      name: "voice-agent-demo",
      partialize: (s) => ({
        messages: s.messages,
        tasks: s.tasks,
        audit: s.audit,
        consoleLines: s.consoleLines,
        relay: s.relay,
        sessions: s.sessions,
        currentSessionId: s.currentSessionId,
        settings: s.settings,
        workspace: s.workspace,
      }),
    },
  ),
);

export const selectCompletedTasks = (s: DemoState) =>
  s.tasks.filter((t) => t.status === "completed");
