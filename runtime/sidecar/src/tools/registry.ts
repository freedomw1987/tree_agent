import type { RiskLevel, ToolSpec } from "./types";

/**
 * M04 工具註冊表
 * 規則：每個工具 **必須** 有 riskLevel；冇就拒絕註冊（避免「唔知有幾危險」嘅工具）。
 */
export class ToolRegistry {
  private readonly tools = new Map<string, ToolSpec<Record<string, unknown>>>();

  register<P>(tool: ToolSpec<P>): void {
    if (!tool.name) throw new Error("工具必須有 name");
    if (!tool.riskLevel) {
      throw new Error(
        `工具 ${tool.name} 冇 riskLevel —— 必須標明係 read_only / write / external_effect 先可以註冊`,
      );
    }
    if (!isRiskLevel(tool.riskLevel)) {
      throw new Error(
        `工具 ${tool.name} 嘅 riskLevel 唔啱：${String(tool.riskLevel)}（只准 read_only / write / external_effect）`,
      );
    }
    if (this.tools.has(tool.name)) {
      throw new Error(`工具名重複：${tool.name}`);
    }
    this.tools.set(tool.name, tool as unknown as ToolSpec<Record<string, unknown>>);
  }

  get(name: string): ToolSpec<Record<string, unknown>> | undefined {
    return this.tools.get(name);
  }

  list(): ToolSpec<Record<string, unknown>>[] {
    return [...this.tools.values()];
  }

  /** 風險級別分佈（用嚟喺 audit / UI 顯示） */
  byRisk(): Record<RiskLevel, number> {
    const out: Record<RiskLevel, number> = { read_only: 0, write: 0, external_effect: 0 };
    for (const t of this.tools.values()) out[t.riskLevel] += 1;
    return out;
  }
}

export function isRiskLevel(v: unknown): v is RiskLevel {
  return v === "read_only" || v === "write" || v === "external_effect";
}
