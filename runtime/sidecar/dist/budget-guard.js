/**
 * M03 單任務預算上限（US-141 嘅代碼部分）
 *
 * 目的：唔好畀一個失控嘅任務燒完錢 / 拖到天光。
 * 規則：
 *  - 時間上限：超過 maxDurationMs → 中止（partial）＋ 通知
 *  - token 上限（可選）：超過 maxTokens → 中止（partial）＋ 通知
 *
 * 唔做：邊啲任務值唔值得跑（屬 M04 風險閘 / 人手判斷）
 */
export class BudgetGuard {
    budget;
    opts;
    startedAt = 0;
    running = false;
    timer = null;
    now;
    pollIntervalMs;
    constructor(budget, opts = {}) {
        this.budget = budget;
        this.opts = opts;
        this.now = opts.now ?? (() => Date.now());
        this.pollIntervalMs = opts.pollIntervalMs ?? 500;
    }
    start() {
        if (this.running)
            return;
        this.running = true;
        this.startedAt = this.now();
        this.timer = setInterval(() => {
            const result = this.check();
            if (!result.ok) {
                this.opts.onExceeded?.(result.reason ?? "超預算");
                this.stop();
            }
        }, this.pollIntervalMs);
        // 唔好阻住 process 退出
        this.timer.unref?.();
    }
    stop() {
        this.running = false;
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
    }
    /** 檢查（有冇超時／超 token）；tokensUsed 可選（由 caller 提供） */
    check(tokensUsed) {
        if (!this.running)
            return { ok: true };
        const elapsed = this.now() - this.startedAt;
        if (elapsed > this.budget.maxDurationMs) {
            return {
                ok: false,
                reason: `任務超時：已用 ${Math.round(elapsed)}ms，超出上限 ${this.budget.maxDurationMs}ms`,
            };
        }
        if (this.budget.maxTokens !== undefined && tokensUsed !== undefined && tokensUsed > this.budget.maxTokens) {
            return {
                ok: false,
                reason: `任務 token 超標：已用 ${tokensUsed}，超出上限 ${this.budget.maxTokens}`,
            };
        }
        return { ok: true };
    }
    remainingMs() {
        if (!this.running)
            return this.budget.maxDurationMs;
        const elapsed = this.now() - this.startedAt;
        return Math.max(0, this.budget.maxDurationMs - elapsed);
    }
    get elapsedMs() {
        if (!this.running)
            return 0;
        return this.now() - this.startedAt;
    }
}
/** 從環境變數讀預算（單用戶預設：15 分鐘，唔燒太多） */
export function defaultBudgetFromEnv(env = process.env) {
    const maxDurationMs = Number(env.VOICE_AGENT_TASK_MAX_MS ?? 15 * 60 * 1000);
    const maxTokens = env.VOICE_AGENT_TASK_MAX_TOKENS
        ? Number(env.VOICE_AGENT_TASK_MAX_TOKENS)
        : undefined;
    return {
        maxDurationMs: Number.isFinite(maxDurationMs) && maxDurationMs > 0 ? maxDurationMs : 15 * 60 * 1000,
        maxTokens: maxTokens && Number.isFinite(maxTokens) ? maxTokens : undefined,
    };
}
