import { describe, expect, it } from "vitest";
import { AuditLog } from "../src/tools/audit-log";
import { ConfirmStore, parseVoiceDecision } from "../src/tools/confirm";
import { executeTool } from "../src/tools/execute";
import { ToolRegistry } from "../src/tools/registry";
import type { ToolSpec } from "../src/tools/types";

/**
 * M04 工具治理層 contract
 * 探針名：M04-tool-*
 */
function makeTool(over: Partial<ToolSpec> = {}): ToolSpec & { calls: number } {
  const t = {
    name: "demo.tool",
    label: "Demo 工具",
    description: "測試用",
    riskLevel: "read_only" as const,
    parameters: {},
    calls: 0,
    run: () => {
      t.calls += 1;
      return { ok: true, text: "做完" };
    },
    ...over,
  } as ToolSpec & { calls: number };
  return t;
}

describe("M04 工具治理層", () => {
  it("M04-tool-registry-requires-risk-level", () => {
    const reg = new ToolRegistry();
    // 故意漏咗 riskLevel（用 cast 模擬「執行時先發現冇風險級別」）
    const bad = { ...makeTool() } as Record<string, unknown>;
    delete bad.riskLevel;
    expect(() => reg.register(bad as unknown as ToolSpec)).toThrow(/riskLevel/);
  });

  it("M04-tool-registry-rejects-duplicate-names", () => {
    const reg = new ToolRegistry();
    reg.register(makeTool());
    expect(() => reg.register(makeTool())).toThrow(/重複/);
  });

  it("M04-tool-read-only-runs-without-confirmation", async () => {
    const reg = new ToolRegistry();
    const tool = makeTool();
    reg.register(tool);
    const audit = new AuditLog();
    const confirms = new ConfirmStore();

    const res = await executeTool({ registry: reg, confirms, audit }, "demo.tool", { a: 1 });

    expect(res.ok).toBe(true);
    expect(tool.calls).toBe(1);
    expect(confirms.pendingCount()).toBe(0);
    expect(audit.all()[0]?.outcome).toBe("ok");
  });

  it("M04-tool-write-tool-waits-for-confirmation", async () => {
    const reg = new ToolRegistry();
    const tool = makeTool({ riskLevel: "write", preview: () => "diff: 1 行改動" });
    reg.register(tool);
    const audit = new AuditLog();
    const confirms = new ConfirmStore();
    const seen: unknown[] = [];

    const pending = executeTool(
      { registry: reg, confirms, audit, onConfirmRequest: (r) => seen.push(r) },
      "demo.tool",
      { file: "a.md" },
    );

    // 未確認之前唔應該行
    await new Promise((r) => setTimeout(r, 20));
    expect(tool.calls).toBe(0);
    expect(seen).toHaveLength(1);
    expect((seen[0] as { preview: string }).preview).toBe("diff: 1 行改動");

    confirms.approve((seen[0] as { id: string }).id);
    const res = await pending;
    expect(res.ok).toBe(true);
    expect(tool.calls).toBe(1);
    expect(audit.all()[0]?.outcome).toBe("ok");
  });

  it("M04-tool-cancelled-write-tool-never-runs", async () => {
    const reg = new ToolRegistry();
    const tool = makeTool({ riskLevel: "write" });
    reg.register(tool);
    const audit = new AuditLog();
    const confirms = new ConfirmStore();
    let id = "";

    const pending = executeTool(
      { registry: reg, confirms, audit, onConfirmRequest: (r) => (id = r.id) },
      "demo.tool",
      {},
    );
    await new Promise((r) => setTimeout(r, 20));
    confirms.cancel(id);

    const res = await pending;
    expect(res.ok).toBe(false);
    expect(res.text).toContain("取消");
    expect(tool.calls).toBe(0);
    expect(audit.all()[0]?.outcome).toBe("cancelled");
  });

  it("M04-tool-expired-confirmation-never-runs", async () => {
    const reg = new ToolRegistry();
    const tool = makeTool({ riskLevel: "write" });
    reg.register(tool);
    const audit = new AuditLog();
    const confirms = new ConfirmStore(20); // 20ms TTL

    const res = await executeTool({ registry: reg, confirms, audit }, "demo.tool", {});
    expect(res.ok).toBe(false);
    expect(res.text).toContain("超時");
    expect(tool.calls).toBe(0);
    expect(audit.all()[0]?.outcome).toBe("expired");
  });

  it("M04-tool-unregistered-tool-fails-loudly", async () => {
    const audit = new AuditLog();
    const res = await executeTool(
      { registry: new ToolRegistry(), confirms: new ConfirmStore(), audit },
      "唔存在",
      {},
    );
    expect(res.ok).toBe(false);
    expect(res.text).toContain("未註冊");
    expect(audit.all()[0]?.outcome).toBe("failed");
  });

  it("M04-tool-audit-log-records-risk-and-digest", async () => {
    const reg = new ToolRegistry();
    reg.register(makeTool({ riskLevel: "read_only" }));
    const audit = new AuditLog();
    await executeTool({ registry: reg, confirms: new ConfirmStore(), audit }, "demo.tool", {
      file: "x.md",
      content: "秘密內容唔應該全文入 audit",
    });

    const entry = audit.all()[0]!;
    expect(entry.riskLevel).toBe("read_only");
    expect(entry.argsDigest).toContain("file");
    expect(entry.argsDigest).not.toContain("秘密內容");
  });

  it("M04-tool-voice-confirm-parses-commands", () => {
    expect(parseVoiceDecision("confirm")).toEqual({ kind: "approved" });
    expect(parseVoiceDecision("確認")?.kind).toBe("approved");
    expect(parseVoiceDecision("取消")).toEqual({ kind: "cancelled" });
    expect(parseVoiceDecision("幫我寫封 email")).toBeNull();
  });

  it("M04-tool-risk-levels-are-enforced-per-tool", async () => {
    const reg = new ToolRegistry();
    const readOnly = makeTool({ name: "ro", riskLevel: "read_only" });
    const ext = makeTool({ name: "ext", riskLevel: "external_effect" });
    reg.register(readOnly);
    reg.register(ext);
    expect(reg.byRisk()).toEqual({ read_only: 1, write: 0, external_effect: 1 });
  });
});
