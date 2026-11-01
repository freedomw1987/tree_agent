import { describe, expect, it } from "vitest";
import { SessionHost, type AgentSessionLike, type SessionFactory } from "../src/session-host";

/**
 * M03 預算上限接入 session host（超時 → abort → partial）
 * 探針名：M03-sidecar-budget-*
 */
class SlowSession implements AgentSessionLike {
  aborted = false;
  constructor(
    readonly sessionId: string,
    private readonly delayMs: number,
  ) {}

  async prompt(): Promise<void> {
    await new Promise((r) => setTimeout(r, this.delayMs));
  }

  subscribe(_cb: (event: unknown) => void): () => void {
    return () => {};
  }

  getLastAssistantText(): string | undefined {
    return "做咗一半";
  }

  dispose(): void {}

  abort(): void {
    this.aborted = true;
  }
}

function makeHost(budgetMs: number, delayMs: number) {
  const session = new SlowSession("s-budget", delayMs);
  const factory: SessionFactory = {
    async create() {
      return session;
    },
    async fork() {
      return session;
    },
    async list() {
      return [];
    },
  };
  const host = new SessionHost({
    workspace: "/tmp/ws",
    factory,
    budget: { maxDurationMs: budgetMs },
    budgetGuardOptions: { pollIntervalMs: 10 },
  });
  const msgs: Array<{ type: string; message?: string; text?: string }> = [];
  host.onMessage((m) => msgs.push(m));
  return { host, session, msgs };
}

describe("M03 session host 預算上限", () => {
  it("M03-sidecar-budget-session-aborts-when-exceeded", async () => {
    const { host, session, msgs } = makeHost(20, 200);

    await host.prompt("跑個好耐嘅任務", "r-budget");

    expect(session.aborted).toBe(true);
    expect(msgs.some((m) => m.type === "partial")).toBe(true);
    const partial = msgs.find((m) => m.type === "partial");
    expect(partial?.message).toContain("超時");
  });

  it("M03-sidecar-budget-session-completes-within-budget", async () => {
    const { host, session, msgs } = makeHost(5000, 10);

    await host.prompt("短任務", "r-ok");

    expect(session.aborted).toBe(false);
    expect(msgs.some((m) => m.type === "partial")).toBe(false);
    expect(msgs.some((m) => m.type === "done")).toBe(true);
  });

  it("M03-sidecar-budget-per-call-override-wins", async () => {
    const { host, session, msgs } = makeHost(5000, 200);

    await host.prompt("用短預算", "r-override", { maxDurationMs: 20 });

    expect(session.aborted).toBe(true);
    expect(msgs.some((m) => m.type === "partial")).toBe(true);
  });
});
