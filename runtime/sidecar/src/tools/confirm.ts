import type { ConfirmDecision, ConfirmRequest, PendingConfirm } from "./types";

/**
 * M04 確認卡生命週期
 *  - pending → approved / cancelled / expired
 *  - 5 分鐘 TTL（過期自動當拒絕，唔會「等人」）
 *  - 語音「confirm」等效（由 caller 解析後呼叫 approve）
 */
export const CONFIRM_TTL_MS = 5 * 60 * 1000;

export class ConfirmStore {
  private readonly pending = new Map<string, PendingConfirm>();

  constructor(private readonly ttlMs: number = CONFIRM_TTL_MS) {}

  /** 產生一張確認卡並等結果 */
  request(input: {
    id: string;
    toolName: string;
    toolLabel: string;
    riskLevel: ConfirmRequest["riskLevel"];
    preview: string;
  }): { request: ConfirmRequest; promise: Promise<ConfirmDecision> } {
    // 同一個 id 已經喺度 → 直接拒絕（避免重複確認卡）
    if (this.pending.has(input.id)) {
      return {
        request: this.pending.get(input.id)!.request,
        promise: Promise.resolve({ kind: "cancelled" }),
      };
    }

    const request: ConfirmRequest = {
      ...input,
      expiresAt: Date.now() + this.ttlMs,
    };
    const promise = new Promise<ConfirmDecision>((resolve) => {
      this.pending.set(input.id, { request, resolve });
      // 過期 → 自動拒絕
      const timer = setTimeout(() => {
        this.expire(input.id);
      }, this.ttlMs);
      timer.unref?.();
    });
    return { request, promise };
  }

  /** 用戶確認（可以由語音「confirm」觸發） */
  approve(id: string): boolean {
    const entry = this.pending.get(id);
    if (!entry) return false;
    this.pending.delete(id);
    entry.resolve({ kind: "approved" });
    return true;
  }

  /** 用戶取消 */
  cancel(id: string): boolean {
    const entry = this.pending.get(id);
    if (!entry) return false;
    this.pending.delete(id);
    entry.resolve({ kind: "cancelled" });
    return true;
  }

  /** 過期 */
  expire(id: string): boolean {
    const entry = this.pending.get(id);
    if (!entry) return false;
    this.pending.delete(id);
    entry.resolve({ kind: "expired" });
    return true;
  }

  isPending(id: string): boolean {
    return this.pending.has(id);
  }

  pendingCount(): number {
    return this.pending.size;
  }

  list(): ConfirmRequest[] {
    return [...this.pending.values()].map((p) => p.request);
  }
}

/** 語音確認嘅關鍵字（講「confirm」／「確認」就係批） */
const CONFIRM_WORDS = ["confirm", "確認", "ok", "好", "yes", "批准"];
const CANCEL_WORDS = ["cancel", "取消", "no", "唔好", "唔使"];

/** 由語音文字解析確認決定（回 null = 唔係確認指令） */
export function parseVoiceDecision(text: string): ConfirmDecision | null {
  const t = text.trim().toLowerCase().replace(/[。！!,.，]/g, "");
  if (!t) return null;
  if (CANCEL_WORDS.some((w) => t === w || t.startsWith(w))) return { kind: "cancelled" };
  if (CONFIRM_WORDS.some((w) => t === w || t.startsWith(w))) return { kind: "approved" };
  return null;
}
