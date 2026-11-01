import type { Message } from "./protocol";
import { BudgetGuard, defaultBudgetFromEnv, type BudgetGuardOptions, type TaskBudget } from "./budget-guard";

/**
 * M03 session host —— Pi SDK session 嘅宿主
 *
 * 職責（嚴格喺 M03 邊界內）：
 *  - 建立 / 續用 / 分岔 Pi SDK session（cwd = Workspace）
 *  - 對話 session 自動分流：同一話題續舊、新話題開新並自動命名
 *  - prompt → streaming chunk → done
 *  - dispose（App 閂咗／Mac 瞓咗 → 跟 App 生死）
 *
 * 唔做（屬 M04）：Risk Gate、工具審批、audit log
 */

export interface AgentSessionLike {
  sessionId: string;
  sessionFile?: string;
  prompt(text: string): Promise<void>;
  subscribe(cb: (event: unknown) => void): () => void;
  getLastAssistantText(): string | undefined;
  dispose(): void;
  /** 中止進行中嘅操作（超預算時用；Pi SDK 有 session.abort()） */
  abort?(): Promise<void> | void;
}

export interface SessionFactory {
  create(opts: { cwd: string }): Promise<AgentSessionLike>;
  fork(opts: { cwd: string; sessionId: string }): Promise<AgentSessionLike>;
  list(cwd: string): Promise<Array<{ id: string; path: string; firstMessage?: string }>>;
}

export interface HostOptions {
  workspace: string;
  factory: SessionFactory;
  /** 話題規則：命中就開／續對應 session；冇命中就續當前 */
  topicRules?: Array<{ re: RegExp; title: string }>;
  /** 單任務預算（超時／超 token → 中止 → partial） */
  budget?: TaskBudget;
  /** 預算檢查細節（測試可注入短 poll 間隔） */
  budgetGuardOptions?: BudgetGuardOptions;
}

interface TrackedSession {
  /** 而家呢個 session 有冇任務喺度跑（SDK 唔准同一個 session 同時跑兩個 prompt） */
  busy: boolean;
  session: AgentSessionLike;
  title: string;
  untitled: boolean;
}

const DEFAULT_TOPIC_RULES: Array<{ re: RegExp; title: string }> = [
  { re: /客戶|客|報價|email|郵件|合約/i, title: "客戶跟進" },
  { re: /交付|摘要|進度|週報|總結|排程/i, title: "交付與進度" },
  { re: /會議|會議紀錄|meeting|議程/i, title: "會議跟進" },
  { re: /帳單|發票|付款|invoice|報銷/i, title: "帳務處理" },
];

const UNTITLED = "新對話";

export class SessionHost {
  private readonly sessions: TrackedSession[] = [];
  private readonly topicRules: Array<{ re: RegExp; title: string }>;
  private current: TrackedSession | null = null;
  private listeners: Array<(m: Message) => void> = [];
  private started = false;

  constructor(private readonly opts: HostOptions) {
    this.topicRules = opts.topicRules ?? DEFAULT_TOPIC_RULES;
  }

  onMessage(cb: (m: Message) => void): void {
    this.listeners.push(cb);
  }

  private emit(m: Message): void {
    for (const cb of this.listeners) cb(m);
  }

  /** 起 session（App 開住 → sidecar 醒） */
  async start(): Promise<void> {
    if (this.started) return;
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
    } catch (err) {
      this.emit({ type: "error", message: this.describeError(err) });
    }
  }

  private track(session: AgentSessionLike, title: string, untitled = false): TrackedSession {
    const tracked: TrackedSession = { session, title, untitled, busy: false };
    session.subscribe((event) => this.onSessionEvent(event));
    this.sessions.push(tracked);
    this.current = tracked;
    return tracked;
  }

  private onSessionEvent(event: unknown): void {
    const e = event as {
      type?: string;
      assistantMessageEvent?: { type?: string; delta?: string };
    };
    if (e?.type === "message_update" && e.assistantMessageEvent?.type === "text_delta") {
      const delta = e.assistantMessageEvent.delta ?? "";
      if (delta) this.emit({ type: "chunk", text: delta });
    }
  }

  /** 話題 → session 標題（命中規則就用規則名；冇命中就續當前） */
  private deriveTopic(text: string): string | null {
    for (const rule of this.topicRules) {
      if (rule.re.test(text)) return rule.title;
    }
    return null;
  }

  /** 分流：同一話題 → 續舊；新話題 → 開新並自動命名 */
  private route(text: string): TrackedSession | null {
    const topic = this.deriveTopic(text);
    if (!topic) return this.current;

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

  async prompt(text: string, id?: string, budgetOverride?: TaskBudget): Promise<void> {
    if (!this.started) await this.start();
    if (!this.current) {
      this.emit({ type: "error", id, message: "Session 未就緒：sidecar 開唔到 Pi SDK session" });
      return;
    }

    let target = this.route(text);

    // ⚠️ SDK 唔准同一個 session 同時跑兩個 prompt（"Agent is already processing"）
    //    如果路由到嘅 session 仲喺度跑緊（例如上一個任務被中止但 SDK 仲未釋放）→ 另開新 session
    if (target?.busy) {
      target = null;
    }

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
      } catch (err) {
        this.emit({ type: "error", id, message: this.describeError(err) });
        return;
      }
    }

    target.busy = true;
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
      } finally {
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
    } catch (err) {
      this.emit({ type: "error", id, message: this.describeError(err) });
    } finally {
      // 呢個 session 收工 → 可以接下一個任務
      target.busy = false;
    }
  }

  /** 分岔：帶住舊上文開新（原 session 唔受影響） */
  async fork(id?: string): Promise<void> {
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
    } catch (err) {
      this.emit({ type: "error", id, message: this.describeError(err) });
    }
  }

  switchSession(sessionId: string): boolean {
    const hit = this.sessions.find((s) => s.session.sessionId === sessionId);
    if (!hit) return false;
    this.current = hit;
    this.emit({
      type: "ready",
      sessionId: hit.session.sessionId,
      sessionTitle: hit.title,
      workspace: this.opts.workspace,
    });
    return true;
  }

  listSessions(): Array<{ sessionId: string; title: string; current: boolean }> {
    return this.sessions.map((s) => ({
      sessionId: s.session.sessionId,
      title: s.title,
      current: s === this.current,
    }));
  }

  /** 收工：dispose 晒（唔留孤兒 process、session 檔保留喺 Mac 本地） */
  async dispose(): Promise<void> {
    for (const s of this.sessions) {
      try {
        s.session.dispose();
      } catch {
        /* dispose 失敗唔阻其他 session */
      }
    }
    this.sessions.length = 0;
    this.current = null;
    this.started = false;
  }

  private describeError(err: unknown): string {
    const msg = err instanceof Error ? err.message : String(err);
    return `Sidecar 錯誤：${msg}`;
  }
}
