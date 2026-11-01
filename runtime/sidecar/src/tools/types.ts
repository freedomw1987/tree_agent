/** M04 工具治理層嘅型別（風險級別係唯一必填欄位） */

export type RiskLevel = "read_only" | "write" | "external_effect";

export interface ToolSpec<P = Record<string, unknown>> {
  /** 工具名（唯一） */
  name: string;
  label: string;
  description: string;
  /** ⬇️ 必填：風險級別。冇咗就唔准註冊 */
  riskLevel: RiskLevel;
  /** JSON schema（俾 Pi SDK 用） */
  parameters: Record<string, unknown>;
  /**
   * 確認之前嘅預檢（例如危險命令黑名單）
   * 回 { ok: false } 就唔會出確認卡，直接拒絕
   */
  preflight?: (args: P) => { ok: true } | { ok: false; text: string };
  /** 真正執行 */
  run(args: P): Promise<ToolResult> | ToolResult;
  /** 俾用戶睇嘅預覽（confirm 卡用；預設用 args 摘要） */
  preview?: (args: P) => string;
}

export interface ToolResult {
  ok: boolean;
  /** 俾 Agent 睇嘅文字 */
  text: string;
  /** 結構化詳情（可選） */
  details?: Record<string, unknown>;
}

/** 確認請求（sidecar → 前端） */
export interface ConfirmRequest {
  /** 對應 request id（回覆時要帶返） */
  id: string;
  toolName: string;
  toolLabel: string;
  riskLevel: RiskLevel;
  /** 俾用戶睇嘅預覽（diff / payload） */
  preview: string;
  /** 過期時間（epoch ms） */
  expiresAt: number;
}

export type ConfirmDecision =
  | { kind: "approved" }
  | { kind: "cancelled" }
  | { kind: "expired" };

/** 等確認嘅 handle */
export interface PendingConfirm {
  request: ConfirmRequest;
  resolve: (decision: ConfirmDecision) => void;
}
