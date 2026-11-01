import { BudgetGuard, defaultBudgetFromEnv } from "./budget-guard";
const DEFAULT_TOPIC_RULES = [
    { re: /客戶|客|報價|email|郵件|合約/i, title: "客戶跟進" },
    { re: /交付|摘要|進度|週報|總結|排程/i, title: "交付與進度" },
    { re: /會議|會議紀錄|meeting|議程/i, title: "會議跟進" },
    { re: /帳單|發票|付款|invoice|報銷/i, title: "帳務處理" },
];
const UNTITLED = "新對話";
export class SessionHost {
    opts;
    sessions = [];
    topicRules;
    current = null;
    listeners = [];
    started = false;
    constructor(opts) {
        this.opts = opts;
        this.topicRules = opts.topicRules ?? DEFAULT_TOPIC_RULES;
    }
    onMessage(cb) {
        this.listeners.push(cb);
    }
    emit(m) {
        for (const cb of this.listeners)
            cb(m);
    }
    /** 起 session（App 開住 → sidecar 醒） */
    async start() {
        if (this.started)
            return;
        try {
            const session = await this.opts.factory.create({ cwd: this.opts.workspace });
            this.track(session, UNTITLED, true);
            this.started = true;
            this.emit({
                type: "ready",
                sessionId: session.sessionId,
                sessionTitle: UNTITLED,
                workspace: this.opts.workspace,
            });
        }
        catch (err) {
            this.emit({ type: "error", message: this.describeError(err) });
        }
    }
    track(session, title, untitled = false) {
        const tracked = { session, title, untitled };
        session.subscribe((event) => this.onSessionEvent(event));
        this.sessions.push(tracked);
        this.current = tracked;
        return tracked;
    }
    onSessionEvent(event) {
        const e = event;
        if (e?.type === "message_update" && e.assistantMessageEvent?.type === "text_delta") {
            const delta = e.assistantMessageEvent.delta ?? "";
            if (delta)
                this.emit({ type: "chunk", text: delta });
        }
    }
    /** 話題 → session 標題（命中規則就用規則名；冇命中就續當前） */
    deriveTopic(text) {
        for (const rule of this.topicRules) {
            if (rule.re.test(text))
                return rule.title;
        }
        return null;
    }
    /** 分流：同一話題 → 續舊；新話題 → 開新並自動命名 */
    route(text) {
        const topic = this.deriveTopic(text);
        if (!topic)
            return this.current;
        const existing = this.sessions.find((s) => !s.untitled && s.title === topic);
        if (existing) {
            this.current = existing;
            return existing;
        }
        // 仲未命名嘅當前 session → 直接改名（唔開新）
        if (this.current?.untitled) {
            this.current.title = topic;
            this.current.untitled = false;
            this.emit({
                type: "ready",
                sessionId: this.current.session.sessionId,
                sessionTitle: topic,
                workspace: this.opts.workspace,
            });
            return this.current;
        }
        return null; // 需要開新
    }
    async prompt(text, id, budgetOverride) {
        if (!this.started)
            await this.start();
        if (!this.current) {
            this.emit({ type: "error", id, message: "Session 未就緒：sidecar 開唔到 Pi SDK session" });
            return;
        }
        let target = this.route(text);
        if (!target) {
            const topic = this.deriveTopic(text) ?? UNTITLED;
            try {
                const session = await this.opts.factory.create({ cwd: this.opts.workspace });
                target = this.track(session, topic);
                this.emit({
                    type: "ready",
                    sessionId: session.sessionId,
                    sessionTitle: topic,
                    workspace: this.opts.workspace,
                });
            }
            catch (err) {
                this.emit({ type: "error", id, message: this.describeError(err) });
                return;
            }
        }
        try {
            const budget = budgetOverride ?? this.opts.budget ?? defaultBudgetFromEnv();
            let aborted = false;
            const guard = new BudgetGuard(budget, {
                ...this.opts.budgetGuardOptions,
                onExceeded: (reason) => {
                    aborted = true;
                    void target.session.abort?.();
                    this.emit({ type: "partial", id, message: reason, reason });
                },
            });
            guard.start();
            try {
                await target.session.prompt(text);
            }
            finally {
                guard.stop();
            }
            const finalCheck = guard.check();
            if (aborted || !finalCheck.ok) {
                this.emit({
                    type: "partial",
                    id,
                    message: finalCheck.reason ?? "任務超預算，已中止",
                    reason: finalCheck.reason,
                    text: target.session.getLastAssistantText() ?? "",
                });
                return;
            }
            this.emit({ type: "done", id, text: target.session.getLastAssistantText() ?? "" });
        }
        catch (err) {
            this.emit({ type: "error", id, message: this.describeError(err) });
        }
    }
    /** 分岔：帶住舊上文開新（原 session 唔受影響） */
    async fork(id) {
        const base = this.current;
        if (!base) {
            this.emit({ type: "error", id, message: "冇可以分岔嘅 session" });
            return;
        }
        try {
            const session = await this.opts.factory.fork({
                cwd: this.opts.workspace,
                sessionId: base.session.sessionId,
            });
            const tracked = this.track(session, `${base.title}（分岔）`);
            this.emit({
                type: "ready",
                sessionId: tracked.session.sessionId,
                sessionTitle: tracked.title,
                workspace: this.opts.workspace,
            });
        }
        catch (err) {
            this.emit({ type: "error", id, message: this.describeError(err) });
        }
    }
    switchSession(sessionId) {
        const hit = this.sessions.find((s) => s.session.sessionId === sessionId);
        if (!hit)
            return false;
        this.current = hit;
        this.emit({
            type: "ready",
            sessionId: hit.session.sessionId,
            sessionTitle: hit.title,
            workspace: this.opts.workspace,
        });
        return true;
    }
    listSessions() {
        return this.sessions.map((s) => ({
            sessionId: s.session.sessionId,
            title: s.title,
            current: s === this.current,
        }));
    }
    /** 收工：dispose 晒（唔留孤兒 process、session 檔保留喺 Mac 本地） */
    async dispose() {
        for (const s of this.sessions) {
            try {
                s.session.dispose();
            }
            catch {
                /* dispose 失敗唔阻其他 session */
            }
        }
        this.sessions.length = 0;
        this.current = null;
        this.started = false;
    }
    describeError(err) {
        const msg = err instanceof Error ? err.message : String(err);
        return `Sidecar 錯誤：${msg}`;
    }
}
