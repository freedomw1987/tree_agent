import { describe, expect, it, vi } from "vitest";
import { BudgetGuard } from "../src/budget-guard";

/**
 * M03 單任務預算上限（時間／token）
 * 探針名：M03-sidecar-budget-*
 */
describe("M03 budget guard", () => {
  it("M03-sidecar-budget-allows-within-time-budget", () => {
    let now = 1000;
    const guard = new BudgetGuard({ maxDurationMs: 5000 }, { now: () => now });
    guard.start();

    now += 3000;
    const check = guard.check();
    expect(check.ok).toBe(true);
    expect(guard.remainingMs()).toBe(2000);
  });

  it("M03-sidecar-budget-detects-timeout", () => {
    let now = 1000;
    const guard = new BudgetGuard({ maxDurationMs: 5000 }, { now: () => now });
    guard.start();

    now += 5001;
    const check = guard.check();
    expect(check.ok).toBe(false);
    expect(check.reason).toContain("超時");
    expect(check.reason).toContain("5000ms");
  });

  it("M03-sidecar-budget-detects-token-overrun", () => {
    const guard = new BudgetGuard({ maxDurationMs: 60_000, maxTokens: 1000 });
    guard.start();

    expect(guard.check(400).ok).toBe(true);
    const over = guard.check(1200);
    expect(over.ok).toBe(false);
    expect(over.reason).toContain("token");
    expect(over.reason).toContain("1000");
  });

  it("M03-sidecar-budget-not-started-guard-is-not-overrun", () => {
    const guard = new BudgetGuard({ maxDurationMs: 100 });
    // 未 start → 唔應該當超時（避免誤殺）
    expect(guard.check().ok).toBe(true);
  });

  it("M03-sidecar-budget-remaining-is-zero-after-timeout", () => {
    let now = 0;
    const guard = new BudgetGuard({ maxDurationMs: 100 }, { now: () => now });
    guard.start();
    now += 200;
    guard.check();
    expect(guard.remainingMs()).toBe(0);
  });

  it("M03-sidecar-budget-timer-fires-callback-on-overrun", async () => {
    vi.useFakeTimers();
    const onExceeded = vi.fn();
    const guard = new BudgetGuard(
      { maxDurationMs: 1000 },
      { onExceeded, pollIntervalMs: 100 },
    );
    guard.start();

    vi.advanceTimersByTime(1200);
    expect(onExceeded).toHaveBeenCalled();
    expect(String(onExceeded.mock.calls[0]?.[0])).toContain("超時");
    guard.stop();
    vi.useRealTimers();
  });
});
