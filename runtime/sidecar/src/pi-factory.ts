import { SessionManager, createAgentSession } from "@earendil-works/pi-coding-agent";
import type { AgentSessionLike, SessionFactory } from "./session-host";

/**
 * 真 Pi SDK factory（M03 嘅 production 接線）
 *
 * 用 SDK 嘅 session 生命週期 API：
 *  - SessionManager.create(cwd)      → 新 session（file-backed，存喺 Mac 本地）
 *  - SessionManager.continueRecent(cwd) → 續最近一條
 *  - SessionManager.list(cwd)        → 列出 sessions（用嚟做 session 切換 UI）
 *
 * 注意：Pi SDK 係 in-process（Node/Bun），所以 sidecar 必須係 Node 進程，
 *       唔可以直接喺 Rust 裡面叫。
 */

type SdkSession = Awaited<ReturnType<typeof createAgentSession>>["session"];

function wrap(session: SdkSession): AgentSessionLike {
  return {
    sessionId: session.sessionId,
    sessionFile: session.sessionFile,
    prompt: (text: string) => session.prompt(text),
    subscribe: (cb: (event: unknown) => void) => session.subscribe(cb) as unknown as () => void,
    getLastAssistantText: () => session.getLastAssistantText(),
    dispose: () => session.dispose(),
  };
}

export function createPiFactory(options?: { continueRecent?: boolean }): SessionFactory {
  return {
    async create({ cwd }) {
      const manager = options?.continueRecent
        ? SessionManager.continueRecent(cwd)
        : SessionManager.create(cwd);
      const { session } = await createAgentSession({ cwd, sessionManager: manager });
      return wrap(session);
    },

    async fork({ cwd, sessionId }) {
      const all = await SessionManager.list(cwd);
      const target = all.find((s) => s.id === sessionId);
      if (!target) {
        throw new Error(`搵唔到 session ${sessionId}（可能已被清理）`);
      }
      const { session } = await createAgentSession({
        cwd,
        sessionManager: SessionManager.open(target.path),
      });
      return wrap(session);
    },

    async list(cwd) {
      const all = await SessionManager.list(cwd);
      return all.map((s) => ({ id: s.id, path: s.path }));
    },
  };
}
