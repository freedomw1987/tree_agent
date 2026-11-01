/** SPIKE-001：relay transport 嘅共同契約（App ⇄ Relay ⇄ Sidecar） */

export interface RelayTask {
  id: string;
  payload: string;
  /** 發送方時戳（epoch ms）—— 端到端延遲由對方計算 */
  sentAt: number;
}

export type RelayHandler = (task: RelayTask) => void;

/**
 * 每個 transport 都要支援 pub + sub：
 *  - App 端：publish（送任務去）/ subscribe（收結果）
 *  - Sidecar 端：subscribe（收任務）/ publish（送結果）
 */
export interface RelayTransport {
  readonly name: string;
  /** 連線成本：常駐資源（如常駐連線數）—— 用嚟估算閒置月費 */
  readonly idleCostPerMonthUsd: number;
  publish(task: RelayTask): Promise<void>;
  subscribe(handler: RelayHandler): Promise<void>;
  close(): Promise<void>;
}

export interface RoundTripResult {
  received: number;
  latencies: number[];
  p50: number;
  p95: number;
  max: number;
}

/** 端到端延遲百分位 */
export function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[Math.max(0, idx)];
}
