import { describe, expect, it } from "vitest";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Supervisor } from "../src/supervisor";

/**
 * M03 supervisor contract —— sidecar 崩潰後自動重啟（≤ 5 秒）
 * 探針名：M03-sidecar-supervisor-*
 */
function fixture(script: string): { dir: string; file: string } {
  const dir = mkdtempSync(join(tmpdir(), "va-supervisor-"));
  const file = join(dir, "worker.mjs");
  writeFileSync(file, script);
  return { dir, file };
}

describe("M03 sidecar supervisor", () => {
  it("M03-sidecar-supervisor-restarts-crashed-worker", async () => {
    // worker 起咗即死
    const { file } = fixture("process.exit(3);");
    const sup = new Supervisor({
      command: process.execPath,
      args: [file],
      restartDelayMs: 100,
    });

    const started = Date.now();
    sup.start();
    await sup.waitForRestart(1, 5000);
    const elapsed = Date.now() - started;

    expect(sup.restartCount).toBeGreaterThanOrEqual(1);
    expect(elapsed).toBeLessThan(5000); // AC：≤ 5 秒
    await sup.stop();
  }, 15000);

  it("M03-sidecar-supervisor-does-not-restart-after-stop", async () => {
    const { file } = fixture("setTimeout(() => {}, 60000);");
    const sup = new Supervisor({
      command: process.execPath,
      args: [file],
      restartDelayMs: 50,
    });

    sup.start();
    await sup.waitForSpawn(1, 5000);
    await sup.stop();
    const countAfterStop = sup.restartCount;
    await new Promise((r) => setTimeout(r, 400));

    expect(sup.restartCount).toBe(countAfterStop);
    expect(sup.isRunning()).toBe(false);
  }, 15000);

  it("M03-sidecar-supervisor-reports-exit-code", async () => {
    const { file } = fixture("process.exit(7);");
    const sup = new Supervisor({
      command: process.execPath,
      args: [file],
      restartDelayMs: 50,
    });

    let lastCode: number | null = null;
    sup.onExit((code) => {
      lastCode = code;
    });
    sup.start();
    await sup.waitForRestart(1, 5000);

    expect(lastCode).toBe(7);
    await sup.stop();
  }, 15000);
});
