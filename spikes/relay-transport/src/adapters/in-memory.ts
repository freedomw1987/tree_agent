import type { RelayHandler, RelayTask, RelayTransport } from "../types";

/**
 * 記憶體「broker」—— 模擬真實 transport 嘅外部通道（queue / pub-sub）。
 * pub 端同 sub 端係兩個獨立 client，但經同一個 bus 互通（呢點正係 contract 嘅重點）。
 */
export class InMemoryBus {
  private handlers: RelayHandler[] = [];

  publish(task: RelayTask): void {
    for (const h of this.handlers) h({ ...task });
  }

  addHandler(h: RelayHandler): void {
    this.handlers.push(h);
  }

  clear(): void {
    this.handlers = [];
  }
}

/**
 * 記憶體 transport —— 只用嚟做 contract 測試（唔接 AWS），
 * 令 harness 嘅量度邏輯可以被獨立驗證（Gate 1 先紅後綠）。
 */
export class InMemoryTransport implements RelayTransport {
  readonly name = "in-memory";
  readonly idleCostPerMonthUsd = 0;

  /** 每個 publish 有幾多 ms 延遲（模擬網絡） */
  constructor(
    private readonly bus: InMemoryBus,
    private readonly latencyMs = 0,
  ) {}

  async publish(task: RelayTask): Promise<void> {
    const deliver = () => this.bus.publish(task);
    if (this.latencyMs > 0) setTimeout(deliver, this.latencyMs);
    else deliver();
  }

  async subscribe(handler: RelayHandler): Promise<void> {
    this.bus.addHandler(handler);
  }

  async close(): Promise<void> {
    this.bus.clear();
  }
}
