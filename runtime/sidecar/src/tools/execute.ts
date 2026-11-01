import { AuditLog } from "./audit-log";
import { ConfirmStore } from "./confirm";
import { ToolRegistry } from "./registry";
import type { RiskLevel, ToolResult } from "./types";

/**
 * M04 統一執行入口 —— 所有工具調用都一定要經呢度
 *
 * 流程：
 *   1. 查 registry（冇註冊 → failed）
 *   2. read_only → 直接跑
 *      write / external_effect → 產生確認卡 → 等用戶（5 分鐘 TTL）→ 批咗先跑
 *   3. 寫 audit log（成功／失敗／被取消／過期）
 */
export interface ExecuteDeps {
  registry: ToolRegistry;
  confirms: ConfirmStore;
  audit: AuditLog;
  /** 產生確認 id */
  newConfirmId?: () => string;
  /** 有新確認卡時通知（例如經 IPC 送到前端） */
  onConfirmRequest?: (req: {
    id: string;
    toolName: string;
    toolLabel: string;
    riskLevel: RiskLevel;
    preview: string;
    expiresAt: number;
  }) => void;
}

export async function executeTool(
  deps: ExecuteDeps,
  toolName: string,
  args: Record<string, unknown>,
): Promise<ToolResult> {
  const { registry, confirms, audit } = deps;
  const tool = registry.get(toolName);

  if (!tool) {
    const msg = `工具未註冊：${toolName}`;
    audit.log({ tool: toolName, riskLevel: "read_only", args, outcome: "failed", result: msg });
    return { ok: false, text: msg };
  }

  // read_only → 直接跑
  if (tool.riskLevel === "read_only") {
    try {
      const result = await tool.run(args);
      audit.log({
        tool: toolName,
        riskLevel: tool.riskLevel,
        args,
        outcome: result.ok ? "ok" : "failed",
        result,
      });
      return result;
    } catch (err) {
      const msg = `工具 ${toolName} 執行失敗：${errText(err)}`;
      audit.log({ tool: toolName, riskLevel: tool.riskLevel, args, outcome: "failed", result: msg });
      return { ok: false, text: msg };
    }
  }

  // write / external_effect → 要確認
  const id = deps.newConfirmId ? deps.newConfirmId() : `cf-${Date.now().toString(36)}`;
  const preview = tool.preview ? tool.preview(args) : summarise(args);
  const { request, promise } = confirms.request({
    id,
    toolName,
    toolLabel: tool.label,
    riskLevel: tool.riskLevel,
    preview,
  });
  deps.onConfirmRequest?.(request);

  const decision = await promise;
  if (decision.kind !== "approved") {
    const outcome = decision.kind === "expired" ? "expired" : "cancelled";
    const msg =
      decision.kind === "expired"
        ? `確認超時（5 分鐘），${toolName} 冇執行`
        : `用戶取消咗，${toolName} 冇執行`;
    audit.log({ tool: toolName, riskLevel: tool.riskLevel, args, outcome, result: msg });
    return { ok: false, text: msg };
  }

  try {
    const result = await tool.run(args);
    audit.log({
      tool: toolName,
      riskLevel: tool.riskLevel,
      args,
      outcome: result.ok ? "ok" : "failed",
      result,
    });
    return result;
  } catch (err) {
    const msg = `工具 ${toolName} 執行失敗：${errText(err)}`;
    audit.log({ tool: toolName, riskLevel: tool.riskLevel, args, outcome: "failed", result: msg });
    return { ok: false, text: msg };
  }
}

function summarise(args: Record<string, unknown>): string {
  const keys = Object.keys(args ?? {});
  return keys.length ? `{${keys.join(", ")}}` : "{}";
}

function errText(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
