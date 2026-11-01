import type { RiskLevel, ToolResult } from "./types";

/**
 * M04 audit log —— 每次工具調用都留痕
 * 記錄：工具 / 風險級別 / 參數摘要（唔記全文，避免敏感內容入 log）/ 結果 / 時間
 */
export interface AuditEntry {
  id: string;
  ts: number;
  tool: string;
  riskLevel: RiskLevel;
  /** 參數摘要（截斷） */
  argsDigest: string;
  /** 執行結果：ok / failed / blocked / cancelled / expired */
  outcome: "ok" | "failed" | "blocked" | "cancelled" | "expired";
  resultDigest: string;
}

export interface AuditLogOptions {
  /** 保留幾多条（預設 500） */
  maxEntries?: number;
  now?: () => number;
}

export class AuditLog {
  private readonly entries: AuditEntry[] = [];
  private readonly maxEntries: number;
  private readonly now: () => number;
  private seq = 0;

  constructor(opts: AuditLogOptions = {}) {
    this.maxEntries = opts.maxEntries ?? 500;
    this.now = opts.now ?? (() => Date.now());
  }

  log(input: {
    tool: string;
    riskLevel: RiskLevel;
    args: unknown;
    outcome: AuditEntry["outcome"];
    result?: ToolResult | string;
  }): AuditEntry {
    this.seq += 1;
    const entry: AuditEntry = {
      id: `audit-${this.seq}`,
      ts: this.now(),
      tool: input.tool,
      riskLevel: input.riskLevel,
      argsDigest: digest(input.args),
      outcome: input.outcome,
      resultDigest: digest(input.result),
    };
    this.entries.push(entry);
    if (this.entries.length > this.maxEntries) this.entries.shift();
    return entry;
  }

  list(limit = 50): AuditEntry[] {
    return this.entries.slice(-limit).reverse();
  }

  all(): AuditEntry[] {
    return [...this.entries];
  }

  count(): number {
    return this.entries.length;
  }
}

/** 摘要：字串取前 120 字；物件取 key 摘要（唔記值全文） */
export function digest(value: unknown): string {
  if (value === undefined || value === null) return "";
  if (typeof value === "string") return value.slice(0, 120);
  if (typeof value !== "object") return String(value);
  const keys = Object.keys(value as Record<string, unknown>);
  return `{${keys.slice(0, 8).join(", ")}${keys.length > 8 ? ", …" : ""}}`;
}
