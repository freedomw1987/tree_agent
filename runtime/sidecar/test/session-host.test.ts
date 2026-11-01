import { describe, expect, it } from "vitest";
import { SessionHost, type AgentSessionLike, type SessionFactory } from "../src/session-host";
import type { Message } from "../src/protocol";

/**
 * M03 session host contract（用 fake session factory → 唔使真 API、唔使錢、deterministic）
 * 真 Pi SDK 整合另見 test/pi-sdk-integration.test.ts（opt-in）
 */
class FakeSession implements AgentSessionLike {
  disposed = false;
  private handler: ((event: unknown) => void) | null = null;

  constructor(
    readonly sessionId: string,
    private readonly chunks: string[],
    public readonly cwd: string,
  ) {}

  async prompt(text: string): Promise<void> {
    this.handler?.({
      type: "message_update",
      assistantMessageEvent: { type: "text_delta", delta: `收到：${text} ` },
    });
    for (const c of this.chunks) {
      this.handler?.({
        type: "message_update",
        assistantMessageEvent: { type: "text_delta", delta: c },
      });
    }
  }

  subscribe(cb: (event: unknown) => void): () => void {
    this.handler = cb;
    return () => {
      this.handler = null;
    };
  }

  getLastAssistantText(): string {
    return this.chunks.join("");
  }

  dispose(): void {
    this.disposed = true;
  }
}

function makeFactory(): SessionFactory & { created: FakeSession[] } {
  const created: FakeSession[] = [];
  let n = 0;
  return {
    created,
    async create(opts) {
      n += 1;
      const s = new FakeSession(`s-${n}`, ["草稿", "完成"], opts.cwd);
      created.push(s);
      return s;
    },
    async fork(opts) {
      const s = new FakeSession(`s-fork-${n}`, ["分岔"], opts.cwd);
      created.push(s);
      return s;
    },
    async list() {
      return [];
    },
  };
}

function collect(host: SessionHost) {
  const msgs: Message[] = [];
  host.onMessage((m) => msgs.push(m));
  return msgs;
}

describe("M03 session host", () => {
  it("M03-sidecar-session-host-start-reports-ready", async () => {
    const factory = makeFactory();
    const host = new SessionHost({ workspace: "/tmp/ws", factory });
    const msgs = collect(host);

    await host.start();

    const ready = msgs.find((m) => m.type === "ready");
    expect(ready).toBeDefined();
    expect(ready?.workspace).toBe("/tmp/ws");
    expect(ready?.sessionId).toBeTruthy();
  });

  it("M03-sidecar-session-host-prompt-emits-chunks-then-done", async () => {
    const factory = makeFactory();
    const host = new SessionHost({ workspace: "/tmp/ws", factory });
    const msgs = collect(host);
    await host.start();

    await host.prompt("幫我寫封 email", "r1");

    const chunks = msgs.filter((m) => m.type === "chunk");
    const done = msgs.filter((m) => m.type === "done");
    expect(chunks.length).toBeGreaterThan(0);
    expect(done.length).toBe(1);
    expect(done[0]?.id).toBe("r1");
    expect(done[0]?.text).toContain("草稿");
  });

  it("M03-sidecar-session-host-routes-same-topic-to-existing-session", async () => {
    const factory = makeFactory();
    const host = new SessionHost({ workspace: "/tmp/ws", factory });
    const msgs = collect(host);
    await host.start();

    await host.prompt("幫我寫封 email 俾客戶", "r1");
    await host.prompt("客戶仲問交貨期，我改下 email", "r2");

    // 第二句屬於同一話題 → 唔應該開新 session
    expect(factory.created.length).toBe(1);
    // ready 訊息 = 1（start） + 1（首次由「新對話」改名為「客戶跟進」）= 2
    // （改名要通知 client 更新標題，所以 ready 係 2 而唔係 1；「冇開新 session」由 created.length 驗證）
    const ready = msgs.filter((m) => m.type === "ready");
    expect(ready.length).toBe(2);
    expect(ready[1]?.sessionTitle).toBe("客戶跟進");
  });

  it("M03-sidecar-session-host-opens-new-session-for-new-topic", async () => {
    const factory = makeFactory();
    const host = new SessionHost({ workspace: "/tmp/ws", factory });
    await host.start();

    await host.prompt("幫我寫封 email 俾客戶", "r1");
    await host.prompt("總結本週交付進度", "r2");

    expect(factory.created.length).toBe(2);
  });

  it("M03-sidecar-session-host-auto-names-new-session", async () => {
    const factory = makeFactory();
    const host = new SessionHost({ workspace: "/tmp/ws", factory });
    const msgs = collect(host);
    await host.start();

    await host.prompt("幫我寫封 email 俾客戶", "r1");

    const ready = msgs.find((m) => m.type === "ready");
    expect(ready?.sessionTitle).toBeTruthy();
    expect(ready?.sessionTitle?.length).toBeGreaterThan(0);
  });

  it("M03-sidecar-session-host-fork-creates-branch-and-keeps-original", async () => {
    const factory = makeFactory();
    const host = new SessionHost({ workspace: "/tmp/ws", factory });
    const msgs = collect(host);
    await host.start();
    await host.prompt("幫我寫封 email 俾客戶", "r1");

    await host.fork("r2");

    const forked = msgs.filter((m) => m.type === "ready").slice(-1)[0];
    expect(factory.created.length).toBe(2);
    expect(forked?.sessionId).toContain("fork");
    // 原 session 仍然喺度（未 dispose）
    expect(factory.created[0]!.disposed).toBe(false);
  });

  it("M03-sidecar-session-host-dispose-closes-sessions", async () => {
    const factory = makeFactory();
    const host = new SessionHost({ workspace: "/tmp/ws", factory });
    await host.start();
    await host.prompt("幫我寫封 email", "r1");

    await host.dispose();

    expect(factory.created[0]!.disposed).toBe(true);
  });

  it("M03-sidecar-session-host-prompt-error-is-reported-not-thrown", async () => {
    const factory: SessionFactory = {
      async create() {
        throw new Error("Pi SDK 開 session 失敗：Workspace 唔存在");
      },
      async fork() {
        throw new Error("唔應該行到 fork");
      },
      async list() {
        return [];
      },
    };
    const host = new SessionHost({ workspace: "/nonexistent", factory });
    const msgs = collect(host);

    await host.start();
    await host.prompt("測試", "r1");

    const err = msgs.find((m) => m.type === "error");
    expect(err).toBeDefined();
    expect(err?.message).toContain("Workspace");
  });
});
