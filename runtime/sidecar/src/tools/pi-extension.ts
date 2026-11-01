import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { executeTool } from "./execute";
import type { ToolRuntime } from "./runtime";

/**
 * M05：將工具目錄掛入 Pi SDK session
 *
 * 每個工具嘅 execute 都經 M04 嘅統一執行入口：
 *   read_only → 自動跑；write / external_effect → 先出確認卡，批咗先跑
 * 每次調用都寫 audit log。
 */

export function createToolCatalogExtension(runtime: ToolRuntime) {
  return (pi: ExtensionAPI): void => {
    for (const tool of runtime.registry.list()) {
      pi.registerTool({
        name: tool.name,
        label: tool.label,
        description: tool.description,
        parameters: tool.parameters as never,
        execute: async (_toolCallId: string, params: unknown) => {
          const args = (params ?? {}) as Record<string, unknown>;
          const result = await executeTool(
            {
              registry: runtime.registry,
              confirms: runtime.confirms,
              audit: runtime.audit,
              onConfirmRequest: runtime.onConfirmRequest,
              newConfirmId: runtime.newConfirmId,
            },
            tool.name,
            args,
          );
          return {
            content: [{ type: "text" as const, text: result.text }],
            details: { ok: result.ok, ...(result.details ?? {}) },
          };
        },
      });
    }
  };
}
