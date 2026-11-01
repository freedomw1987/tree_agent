#!/usr/bin/env node

// src/main.ts
import { createInterface } from "node:readline";

// src/protocol.ts
var ProtocolError = class extends Error {
  constructor(message) {
    super(message);
    this.name = "ProtocolError";
  }
};
function parseRequest(line) {
  const trimmed = line.trim();
  if (!trimmed) throw new ProtocolError("\u7A7A\u767D\u884C\u5514\u4FC2\u6709\u6548 request");
  let raw;
  try {
    raw = JSON.parse(trimmed);
  } catch {
    throw new ProtocolError(`\u5514\u4FC2\u5408\u6CD5 JSON\uFF1A${trimmed.slice(0, 80)}`);
  }
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    throw new ProtocolError("request \u5FC5\u9808\u4FC2 JSON object");
  }
  const obj = raw;
  const type = obj.type;
  const valid = [
    "prompt",
    "status",
    "shutdown",
    "switch_session",
    "fork",
    "new_session"
  ];
  if (typeof type !== "string" || !valid.includes(type)) {
    throw new ProtocolError(`\u672A\u77E5 request type\uFF1A${String(type)}`);
  }
  return obj;
}
function serializeMessage(msg) {
  return JSON.stringify(msg);
}

// src/budget-guard.ts
var BudgetGuard = class {
  constructor(budget, opts = {}) {
    this.budget = budget;
    this.opts = opts;
    this.now = opts.now ?? (() => Date.now());
    this.pollIntervalMs = opts.pollIntervalMs ?? 500;
  }
  startedAt = 0;
  running = false;
  timer = null;
  now;
  pollIntervalMs;
  start() {
    if (this.running) return;
    this.running = true;
    this.startedAt = this.now();
    this.timer = setInterval(() => {
      const result = this.check();
      if (!result.ok) {
        this.opts.onExceeded?.(result.reason ?? "\u8D85\u9810\u7B97");
        this.stop();
      }
    }, this.pollIntervalMs);
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
    if (!this.running) return { ok: true };
    const elapsed = this.now() - this.startedAt;
    if (elapsed > this.budget.maxDurationMs) {
      return {
        ok: false,
        reason: `\u4EFB\u52D9\u8D85\u6642\uFF1A\u5DF2\u7528 ${Math.round(elapsed)}ms\uFF0C\u8D85\u51FA\u4E0A\u9650 ${this.budget.maxDurationMs}ms`
      };
    }
    if (this.budget.maxTokens !== void 0 && tokensUsed !== void 0 && tokensUsed > this.budget.maxTokens) {
      return {
        ok: false,
        reason: `\u4EFB\u52D9 token \u8D85\u6A19\uFF1A\u5DF2\u7528 ${tokensUsed}\uFF0C\u8D85\u51FA\u4E0A\u9650 ${this.budget.maxTokens}`
      };
    }
    return { ok: true };
  }
  remainingMs() {
    if (!this.running) return this.budget.maxDurationMs;
    const elapsed = this.now() - this.startedAt;
    return Math.max(0, this.budget.maxDurationMs - elapsed);
  }
  get elapsedMs() {
    if (!this.running) return 0;
    return this.now() - this.startedAt;
  }
};
function defaultBudgetFromEnv(env = process.env) {
  const maxDurationMs = Number(env.VOICE_AGENT_TASK_MAX_MS ?? 15 * 60 * 1e3);
  const maxTokens = env.VOICE_AGENT_TASK_MAX_TOKENS ? Number(env.VOICE_AGENT_TASK_MAX_TOKENS) : void 0;
  return {
    maxDurationMs: Number.isFinite(maxDurationMs) && maxDurationMs > 0 ? maxDurationMs : 15 * 60 * 1e3,
    maxTokens: maxTokens && Number.isFinite(maxTokens) ? maxTokens : void 0
  };
}

// src/session-host.ts
var DEFAULT_TOPIC_RULES = [
  { re: /客戶|客|報價|email|郵件|合約/i, title: "\u5BA2\u6236\u8DDF\u9032" },
  { re: /交付|摘要|進度|週報|總結|排程/i, title: "\u4EA4\u4ED8\u8207\u9032\u5EA6" },
  { re: /會議|會議紀錄|meeting|議程/i, title: "\u6703\u8B70\u8DDF\u9032" },
  { re: /帳單|發票|付款|invoice|報銷/i, title: "\u5E33\u52D9\u8655\u7406" }
];
var UNTITLED = "\u65B0\u5C0D\u8A71";
var SessionHost = class {
  constructor(opts) {
    this.opts = opts;
    this.topicRules = opts.topicRules ?? DEFAULT_TOPIC_RULES;
  }
  sessions = [];
  topicRules;
  current = null;
  listeners = [];
  started = false;
  onMessage(cb) {
    this.listeners.push(cb);
  }
  emit(m) {
    for (const cb of this.listeners) cb(m);
  }
  /** 起 session（App 開住 → sidecar 醒） */
  async start() {
    if (this.started) return;
    try {
      const session = await this.opts.factory.create({ cwd: this.opts.workspace });
      this.track(session, UNTITLED, true);
      this.started = true;
      this.emit({
        type: "ready",
        sessionId: session.sessionId,
        sessionTitle: UNTITLED,
        workspace: this.opts.workspace
      });
    } catch (err) {
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
      if (delta) this.emit({ type: "chunk", text: delta });
    }
  }
  /** 話題 → session 標題（命中規則就用規則名；冇命中就續當前） */
  deriveTopic(text) {
    for (const rule of this.topicRules) {
      if (rule.re.test(text)) return rule.title;
    }
    return null;
  }
  /** 分流：同一話題 → 續舊；新話題 → 開新並自動命名 */
  route(text) {
    const topic = this.deriveTopic(text);
    if (!topic) return this.current;
    const existing = this.sessions.find((s) => !s.untitled && s.title === topic);
    if (existing) {
      this.current = existing;
      return existing;
    }
    if (this.current?.untitled) {
      this.current.title = topic;
      this.current.untitled = false;
      this.emit({
        type: "ready",
        sessionId: this.current.session.sessionId,
        sessionTitle: topic,
        workspace: this.opts.workspace
      });
      return this.current;
    }
    return null;
  }
  async prompt(text, id, budgetOverride) {
    if (!this.started) await this.start();
    if (!this.current) {
      this.emit({ type: "error", id, message: "Session \u672A\u5C31\u7DD2\uFF1Asidecar \u958B\u5514\u5230 Pi SDK session" });
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
          workspace: this.opts.workspace
        });
      } catch (err) {
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
        }
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
          message: finalCheck.reason ?? "\u4EFB\u52D9\u8D85\u9810\u7B97\uFF0C\u5DF2\u4E2D\u6B62",
          reason: finalCheck.reason,
          text: target.session.getLastAssistantText() ?? ""
        });
        return;
      }
      this.emit({ type: "done", id, text: target.session.getLastAssistantText() ?? "" });
    } catch (err) {
      this.emit({ type: "error", id, message: this.describeError(err) });
    }
  }
  /** 分岔：帶住舊上文開新（原 session 唔受影響） */
  async fork(id) {
    const base = this.current;
    if (!base) {
      this.emit({ type: "error", id, message: "\u5187\u53EF\u4EE5\u5206\u5C94\u5605 session" });
      return;
    }
    try {
      const session = await this.opts.factory.fork({
        cwd: this.opts.workspace,
        sessionId: base.session.sessionId
      });
      const tracked = this.track(session, `${base.title}\uFF08\u5206\u5C94\uFF09`);
      this.emit({
        type: "ready",
        sessionId: tracked.session.sessionId,
        sessionTitle: tracked.title,
        workspace: this.opts.workspace
      });
    } catch (err) {
      this.emit({ type: "error", id, message: this.describeError(err) });
    }
  }
  switchSession(sessionId) {
    const hit = this.sessions.find((s) => s.session.sessionId === sessionId);
    if (!hit) return false;
    this.current = hit;
    this.emit({
      type: "ready",
      sessionId: hit.session.sessionId,
      sessionTitle: hit.title,
      workspace: this.opts.workspace
    });
    return true;
  }
  listSessions() {
    return this.sessions.map((s) => ({
      sessionId: s.session.sessionId,
      title: s.title,
      current: s === this.current
    }));
  }
  /** 收工：dispose 晒（唔留孤兒 process、session 檔保留喺 Mac 本地） */
  async dispose() {
    for (const s of this.sessions) {
      try {
        s.session.dispose();
      } catch {
      }
    }
    this.sessions.length = 0;
    this.current = null;
    this.started = false;
  }
  describeError(err) {
    const msg = err instanceof Error ? err.message : String(err);
    return `Sidecar \u932F\u8AA4\uFF1A${msg}`;
  }
};

// src/pi-factory.ts
import { SessionManager, createAgentSession } from "@earendil-works/pi-coding-agent";
function wrap(session) {
  return {
    sessionId: session.sessionId,
    sessionFile: session.sessionFile,
    prompt: (text) => session.prompt(text),
    subscribe: (cb) => session.subscribe(cb),
    getLastAssistantText: () => session.getLastAssistantText(),
    dispose: () => session.dispose()
  };
}
function createPiFactory(options) {
  return {
    async create({ cwd }) {
      const manager = options?.continueRecent ? SessionManager.continueRecent(cwd) : SessionManager.create(cwd);
      const { session } = await createAgentSession({ cwd, sessionManager: manager });
      return wrap(session);
    },
    async fork({ cwd, sessionId }) {
      const all = await SessionManager.list(cwd);
      const target = all.find((s) => s.id === sessionId);
      if (!target) {
        throw new Error(`\u6435\u5514\u5230 session ${sessionId}\uFF08\u53EF\u80FD\u5DF2\u88AB\u6E05\u7406\uFF09`);
      }
      const { session } = await createAgentSession({
        cwd,
        sessionManager: SessionManager.open(target.path)
      });
      return wrap(session);
    },
    async list(cwd) {
      const all = await SessionManager.list(cwd);
      return all.map((s) => ({ id: s.id, path: s.path }));
    }
  };
}

// src/main.ts
function arg(name, fallback) {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.split("=")[1] : fallback;
}
var workspace = arg("workspace", process.env.VOICE_AGENT_WORKSPACE ?? process.cwd());
var host = new SessionHost({
  workspace,
  factory: createPiFactory(),
  // 單任務預算（US-141）：超時／超 token → abort → partial → 通知
  budget: defaultBudgetFromEnv()
});
host.onMessage((m) => {
  process.stdout.write(`${serializeMessage(m)}
`);
});
var rl = createInterface({ input: process.stdin });
rl.on("line", async (line) => {
  if (!line.trim()) return;
  let req;
  try {
    req = parseRequest(line);
  } catch (err) {
    process.stdout.write(
      `${serializeMessage({ type: "error", message: `\u58DE request\uFF1A${err.message}` })}
`
    );
    return;
  }
  switch (req.type) {
    case "status":
      process.stdout.write(
        `${serializeMessage({
          type: "ready",
          sessionId: host.listSessions().find((s) => s.current)?.sessionId,
          workspace
        })}
`
      );
      break;
    case "prompt":
      await host.prompt(req.text ?? "", req.id);
      break;
    case "fork":
      await host.fork(req.id);
      break;
    case "switch_session":
      if (req.sessionId) host.switchSession(req.sessionId);
      break;
    case "new_session":
      await host.fork(req.id);
      break;
    case "shutdown":
      await host.dispose();
      rl.close();
      process.exit(0);
      break;
  }
});
process.on("SIGTERM", () => {
  void host.dispose().then(() => process.exit(0));
});
await host.start();
