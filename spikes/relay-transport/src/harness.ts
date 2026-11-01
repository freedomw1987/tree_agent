import type { RelayTask, RelayTransport, RoundTripResult } from "./types";
import { percentile } from "./types";

export interface MeasureOptions {
  /** 送幾多個訊息 */
  count: number;
  /** 每個訊息之間嘅間隔（ms）—— 用嚟模擬真實流量 */
  intervalMs?: number;
  /** 由 publish 到 subscribe 收到嘅超時（ms） */
  timeoutMs?: number;
  payload?: string;
}

/**
 * 量度一個 transport 嘅端到端延遲：
 * pub.publish(task) → sub 收到 → latency = now - task.sentAt
 */
export async function measureRoundTrip(
  pub: RelayTransport,
  sub: RelayTransport,
  opts: MeasureOptions,
): Promise<RoundTripResult> {
  const { count, intervalMs = 0, timeoutMs = 15000, payload = "ping" } = opts;
  const latencies: number[] = [];

  let expected = 0;
  let resolveDone: (() => void) | null = null;
  const done = new Promise<void>((r) => {
    resolveDone = r;
  });

  await sub.subscribe((task: RelayTask) => {
    latencies.push(Date.now() - task.sentAt);
    expected += 1;
    if (expected >= count && resolveDone) resolveDone();
  });

  // ⚠️ timeout 一定要 resolve（唔論收到幾多個）—— 否則收到 0 個時會死等
  const timer = setTimeout(() => {
    if (resolveDone) resolveDone();
  }, timeoutMs);

  for (let i = 0; i < count; i++) {
    const task: RelayTask = {
      id: `task-${i}-${Date.now().toString(36)}`,
      payload,
      sentAt: Date.now(),
    };
    await pub.publish(task);
    if (i < count - 1 && intervalMs > 0) {
      await new Promise((r) => setTimeout(r, intervalMs));
    }
  }

  await done;
  clearTimeout(timer);

  return {
    received: latencies.length,
    latencies,
    p50: percentile(latencies, 50),
    p95: percentile(latencies, 95),
    max: latencies.length ? Math.max(...latencies) : 0,
  };
}
