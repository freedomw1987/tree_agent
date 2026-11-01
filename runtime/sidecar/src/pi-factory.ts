import {
  DefaultResourceLoader,
  SessionManager,
  createAgentSession,
  getAgentDir,
} from "@earendil-works/pi-coding-agent";
import type { AgentSessionLike, SessionFactory } from "./session-host";
import { createToolCatalogExtension } from "./tools/pi-extension";
import type { ToolRuntime } from "./tools/runtime";

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

export function createPiFactory(options?: {
  continueRecent?: boolean;
  /** M05 工具 runtime（有工具 → 經 M04 風險閘；冇工具 → 淨係傾計） */
  toolRuntime?: ToolRuntime;
}): SessionFactory {
  /** 建一個 resource loader：將我哋嘅工具目錄掛入 Pi SDK session */
  const makeLoader = async (cwd: string) => {
    const loader = new DefaultResourceLoader({
      cwd,
      agentDir: getAgentDir(),
      extensionFactories: options?.toolRuntime
        ? [createToolCatalogExtension(options.toolRuntime)]
        : [],
    });
    await loader.reload();
    return loader;
  };

  return {
    async create({ cwd }) {
      const manager = options?.continueRecent
        ? SessionManager.continueRecent(cwd)
        : SessionManager.create(cwd);
      const resourceLoader = await makeLoader(cwd);
      // 關閉 Pi SDK 內建工具（佢哋唔經我哋嘅風險閘）→ 淨係用我哋嘅工具目錄
      const { session } = await createAgentSession({
        cwd,
        sessionManager: manager,
        resourceLoader,
        // 停用 SDK 內建工具（佢哋唔經我哋嘅風險閘），但保留 extension 工具
        noTools: "builtin",
      });
      return wrap(session);
    },

    async fork({ cwd, sessionId }) {
      const all = await SessionManager.list(cwd);
      const target = all.find((s) => s.id === sessionId);
      if (!target) {
        throw new Error(`搵唔到 session ${sessionId}（可能已被清理）`);
      }
      const resourceLoader = await makeLoader(cwd);
      const { session } = await createAgentSession({
        cwd,
        sessionManager: SessionManager.open(target.path),
        resourceLoader,
        // 停用 SDK 內建工具（佢哋唔經我哋嘅風險閘），但保留 extension 工具
        noTools: "builtin",
      });
      return wrap(session);
    },

    async list(cwd) {
      const all = await SessionManager.list(cwd);
      return all.map((s) => ({ id: s.id, path: s.path }));
    },
  };
}
