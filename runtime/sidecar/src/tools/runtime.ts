import { AuditLog } from "./audit-log";
import { ConfirmStore } from "./confirm";
import { ToolRegistry } from "./registry";
import { createCatalogTools } from "./catalog";
import type { ConfirmRequest } from "./types";

/**
 * M04 + M05 嘅共用 runtime：registry（工具表）＋ 確認 ＋ audit
 * Sidecar 同 Pi SDK extension 都攞同一個 instance，避免兩邊狀態唔一致。
 */
export interface ToolRuntime {
  registry: ToolRegistry;
  confirms: ConfirmStore;
  audit: AuditLog;
  workspace: string;
  /** 有新確認卡時通知（sidecar 會經 IPC 送到前端） */
  onConfirmRequest?: (req: ConfirmRequest) => void;
  newConfirmId?: () => string;
}

export function createToolRuntime(options: {
  workspace: string;
  onConfirmRequest?: (req: ConfirmRequest) => void;
  confirmTtlMs?: number;
}): ToolRuntime {
  const registry = new ToolRegistry();
  for (const tool of createCatalogTools(options.workspace)) registry.register(tool);

  let seq = 0;
  return {
    registry,
    confirms: new ConfirmStore(options.confirmTtlMs),
    audit: new AuditLog(),
    workspace: options.workspace,
    onConfirmRequest: options.onConfirmRequest,
    newConfirmId: () => `cf-${Date.now().toString(36)}-${++seq}`,
  };
}
