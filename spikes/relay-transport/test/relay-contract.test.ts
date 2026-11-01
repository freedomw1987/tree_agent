import { describe, expect, it } from "vitest";
import { measureRoundTrip } from "../src/harness";
import { InMemoryBus, InMemoryTransport } from "../src/adapters/in-memory";

/**
 * SPIKE-001 contract 測試
 * 探針名：M02-relay-transport-contract-*
 * 目標：驗證量度 harness 對任何 transport 都用同一套契約（pub → sub 收齊、內容原樣、延遲可計）
 */
describe("M02-relay-transport-contract", () => {
  it("M02-relay-transport-contract-publish-reaches-subscriber", async () => {
    const bus = new InMemoryBus();
    const pub = new InMemoryTransport(bus);
    const sub = new InMemoryTransport(bus);
    const result = await measureRoundTrip(pub, sub, { count: 5, payload: "ping" });
    expect(result.received).toBe(5);
    expect(result.latencies.length).toBe(5);
  });

  it("M02-relay-transport-contract-payload-preserved", async () => {
    const bus = new InMemoryBus();
    const pub = new InMemoryTransport(bus);
    const sub = new InMemoryTransport(bus);
    const seen: string[] = [];
    await sub.subscribe((t) => seen.push(t.payload));
    await pub.publish({ id: "x1", payload: "幫我寫封 email", sentAt: Date.now() });
    await new Promise((r) => setTimeout(r, 10));
    expect(seen).toEqual(["幫我寫封 email"]);
  });

  it("M02-relay-transport-contract-latency-is-measured", async () => {
    const bus = new InMemoryBus();
    const pub = new InMemoryTransport(bus);
    const sub = new InMemoryTransport(bus);
    const result = await measureRoundTrip(pub, sub, { count: 3 });
    expect(result.p50).toBeGreaterThanOrEqual(0);
    expect(result.p95).toBeGreaterThanOrEqual(result.p50);
    expect(result.max).toBeGreaterThanOrEqual(result.p95);
  });

  it("M02-relay-transport-contract-timeout-does-not-hang", async () => {
    // 冇人 subscribe → 唔可以死等
    const bus = new InMemoryBus();
    const pub = new InMemoryTransport(bus);
    const sub = new InMemoryTransport(new InMemoryBus());
    const t0 = Date.now();
    const result = await measureRoundTrip(pub, sub, { count: 1, timeoutMs: 300 });
    expect(Date.now() - t0).toBeLessThan(3000);
    expect(result.received).toBe(0);
  });
});
