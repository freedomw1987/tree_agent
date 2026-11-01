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
    "new_session",
    "confirm_response",
    "list_tools",
    "audit_log"
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
    const tracked = { session, title, untitled, busy: false };
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
          workspace: this.opts.workspace
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
    } finally {
      target.busy = false;
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
import {
  DefaultResourceLoader,
  SessionManager,
  createAgentSession,
  getAgentDir
} from "@earendil-works/pi-coding-agent";

// src/tools/audit-log.ts
var AuditLog = class {
  entries = [];
  maxEntries;
  now;
  seq = 0;
  constructor(opts = {}) {
    this.maxEntries = opts.maxEntries ?? 500;
    this.now = opts.now ?? (() => Date.now());
  }
  log(input) {
    this.seq += 1;
    const entry = {
      id: `audit-${this.seq}`,
      ts: this.now(),
      tool: input.tool,
      riskLevel: input.riskLevel,
      argsDigest: digest(input.args),
      outcome: input.outcome,
      resultDigest: digest(input.result)
    };
    this.entries.push(entry);
    if (this.entries.length > this.maxEntries) this.entries.shift();
    return entry;
  }
  list(limit = 50) {
    return this.entries.slice(-limit).reverse();
  }
  all() {
    return [...this.entries];
  }
  count() {
    return this.entries.length;
  }
};
function digest(value) {
  if (value === void 0 || value === null) return "";
  if (typeof value === "string") return value.slice(0, 120);
  if (typeof value !== "object") return String(value);
  const keys = Object.keys(value);
  return `{${keys.slice(0, 8).join(", ")}${keys.length > 8 ? ", \u2026" : ""}}`;
}

// src/tools/confirm.ts
var CONFIRM_TTL_MS = 5 * 60 * 1e3;
var ConfirmStore = class {
  constructor(ttlMs = CONFIRM_TTL_MS) {
    this.ttlMs = ttlMs;
  }
  pending = /* @__PURE__ */ new Map();
  /** 產生一張確認卡並等結果 */
  request(input) {
    if (this.pending.has(input.id)) {
      return {
        request: this.pending.get(input.id).request,
        promise: Promise.resolve({ kind: "cancelled" })
      };
    }
    const request = {
      ...input,
      expiresAt: Date.now() + this.ttlMs
    };
    const promise = new Promise((resolve2) => {
      this.pending.set(input.id, { request, resolve: resolve2 });
      const timer = setTimeout(() => {
        this.expire(input.id);
      }, this.ttlMs);
      timer.unref?.();
    });
    return { request, promise };
  }
  /** 用戶確認（可以由語音「confirm」觸發） */
  approve(id) {
    const entry = this.pending.get(id);
    if (!entry) return false;
    this.pending.delete(id);
    entry.resolve({ kind: "approved" });
    return true;
  }
  /** 用戶取消 */
  cancel(id) {
    const entry = this.pending.get(id);
    if (!entry) return false;
    this.pending.delete(id);
    entry.resolve({ kind: "cancelled" });
    return true;
  }
  /** 過期 */
  expire(id) {
    const entry = this.pending.get(id);
    if (!entry) return false;
    this.pending.delete(id);
    entry.resolve({ kind: "expired" });
    return true;
  }
  isPending(id) {
    return this.pending.has(id);
  }
  pendingCount() {
    return this.pending.size;
  }
  list() {
    return [...this.pending.values()].map((p) => p.request);
  }
};

// src/tools/registry.ts
var ToolRegistry = class {
  tools = /* @__PURE__ */ new Map();
  register(tool) {
    if (!tool.name) throw new Error("\u5DE5\u5177\u5FC5\u9808\u6709 name");
    if (!tool.riskLevel) {
      throw new Error(
        `\u5DE5\u5177 ${tool.name} \u5187 riskLevel \u2014\u2014 \u5FC5\u9808\u6A19\u660E\u4FC2 read_only / write / external_effect \u5148\u53EF\u4EE5\u8A3B\u518A`
      );
    }
    if (!isRiskLevel(tool.riskLevel)) {
      throw new Error(
        `\u5DE5\u5177 ${tool.name} \u5605 riskLevel \u5514\u5571\uFF1A${String(tool.riskLevel)}\uFF08\u53EA\u51C6 read_only / write / external_effect\uFF09`
      );
    }
    if (this.tools.has(tool.name)) {
      throw new Error(`\u5DE5\u5177\u540D\u91CD\u8907\uFF1A${tool.name}`);
    }
    this.tools.set(tool.name, tool);
  }
  get(name) {
    return this.tools.get(name);
  }
  list() {
    return [...this.tools.values()];
  }
  /** 風險級別分佈（用嚟喺 audit / UI 顯示） */
  byRisk() {
    const out = { read_only: 0, write: 0, external_effect: 0 };
    for (const t of this.tools.values()) out[t.riskLevel] += 1;
    return out;
  }
};
function isRiskLevel(v) {
  return v === "read_only" || v === "write" || v === "external_effect";
}

// src/tools/execute.ts
async function executeTool(deps, toolName, args) {
  const { registry, confirms, audit } = deps;
  const tool = registry.get(toolName);
  if (!tool) {
    const msg = `\u5DE5\u5177\u672A\u8A3B\u518A\uFF1A${toolName}`;
    audit.log({ tool: toolName, riskLevel: "read_only", args, outcome: "failed", result: msg });
    return { ok: false, text: msg };
  }
  if (tool.riskLevel === "read_only") {
    try {
      const result = await tool.run(args);
      audit.log({
        tool: toolName,
        riskLevel: tool.riskLevel,
        args,
        outcome: result.ok ? "ok" : "failed",
        result
      });
      return result;
    } catch (err) {
      const msg = `\u5DE5\u5177 ${toolName} \u57F7\u884C\u5931\u6557\uFF1A${errText(err)}`;
      audit.log({ tool: toolName, riskLevel: tool.riskLevel, args, outcome: "failed", result: msg });
      return { ok: false, text: msg };
    }
  }
  if (tool.preflight) {
    const pre = tool.preflight(args);
    if (!pre.ok) {
      audit.log({ tool: toolName, riskLevel: tool.riskLevel, args, outcome: "blocked", result: pre.text });
      return { ok: false, text: pre.text };
    }
  }
  const id = deps.newConfirmId ? deps.newConfirmId() : `cf-${Date.now().toString(36)}`;
  const preview = tool.preview ? tool.preview(args) : summarise(args);
  const { request, promise } = confirms.request({
    id,
    toolName,
    toolLabel: tool.label,
    riskLevel: tool.riskLevel,
    preview
  });
  deps.onConfirmRequest?.(request);
  const decision = await promise;
  if (decision.kind !== "approved") {
    const outcome = decision.kind === "expired" ? "expired" : "cancelled";
    const msg = decision.kind === "expired" ? `\u78BA\u8A8D\u8D85\u6642\uFF085 \u5206\u9418\uFF09\uFF0C${toolName} \u5187\u57F7\u884C` : `\u7528\u6236\u53D6\u6D88\u5497\uFF0C${toolName} \u5187\u57F7\u884C`;
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
      result
    });
    return result;
  } catch (err) {
    const msg = `\u5DE5\u5177 ${toolName} \u57F7\u884C\u5931\u6557\uFF1A${errText(err)}`;
    audit.log({ tool: toolName, riskLevel: tool.riskLevel, args, outcome: "failed", result: msg });
    return { ok: false, text: msg };
  }
}
function summarise(args) {
  const keys = Object.keys(args ?? {});
  return keys.length ? `{${keys.join(", ")}}` : "{}";
}
function errText(err) {
  return err instanceof Error ? err.message : String(err);
}

// src/tools/pi-extension.ts
function createToolCatalogExtension(runtime) {
  return (pi) => {
    for (const tool of runtime.registry.list()) {
      pi.registerTool({
        name: tool.name,
        label: tool.label,
        description: tool.description,
        parameters: tool.parameters,
        execute: async (_toolCallId, params) => {
          const args = params ?? {};
          const result = await executeTool(
            {
              registry: runtime.registry,
              confirms: runtime.confirms,
              audit: runtime.audit,
              onConfirmRequest: runtime.onConfirmRequest,
              newConfirmId: runtime.newConfirmId
            },
            tool.name,
            args
          );
          return {
            content: [{ type: "text", text: result.text }],
            details: { ok: result.ok, ...result.details ?? {} }
          };
        }
      });
    }
  };
}

// src/pi-factory.ts
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
  const makeLoader = async (cwd) => {
    const loader = new DefaultResourceLoader({
      cwd,
      agentDir: getAgentDir(),
      extensionFactories: options?.toolRuntime ? [createToolCatalogExtension(options.toolRuntime)] : []
    });
    await loader.reload();
    return loader;
  };
  return {
    async create({ cwd }) {
      const manager = options?.continueRecent ? SessionManager.continueRecent(cwd) : SessionManager.create(cwd);
      const resourceLoader = await makeLoader(cwd);
      const { session } = await createAgentSession({
        cwd,
        sessionManager: manager,
        resourceLoader,
        // 停用 SDK 內建工具（佢哋唔經我哋嘅風險閘），但保留 extension 工具
        noTools: "builtin"
      });
      return wrap(session);
    },
    async fork({ cwd, sessionId }) {
      const all = await SessionManager.list(cwd);
      const target = all.find((s) => s.id === sessionId);
      if (!target) {
        throw new Error(`\u6435\u5514\u5230 session ${sessionId}\uFF08\u53EF\u80FD\u5DF2\u88AB\u6E05\u7406\uFF09`);
      }
      const resourceLoader = await makeLoader(cwd);
      const { session } = await createAgentSession({
        cwd,
        sessionManager: SessionManager.open(target.path),
        resourceLoader,
        // 停用 SDK 內建工具（佢哋唔經我哋嘅風險閘），但保留 extension 工具
        noTools: "builtin"
      });
      return wrap(session);
    },
    async list(cwd) {
      const all = await SessionManager.list(cwd);
      return all.map((s) => ({ id: s.id, path: s.path }));
    }
  };
}

// src/tools/catalog/fs-tools.ts
import { readFileSync, readdirSync, statSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";

// src/tools/diff.ts
var MAX_LINES = 1200;
function lineDiff(oldText, newText) {
  const a = oldText.split("\n");
  const b = newText.split("\n");
  if (a.length > MAX_LINES || b.length > MAX_LINES) {
    return {
      added: [`\uFF08\u6A94\u6848\u592A\u9577\uFF08${a.length} \u2192 ${b.length} \u884C\uFF09\uFF0C\u53EA\u986F\u793A\u7D71\u8A08\uFF09`],
      removed: [],
      unchanged: 0,
      truncated: true
    };
  }
  const dp = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i2 = a.length - 1; i2 >= 0; i2--) {
    for (let j2 = b.length - 1; j2 >= 0; j2--) {
      dp[i2][j2] = a[i2] === b[j2] ? dp[i2 + 1][j2 + 1] + 1 : Math.max(dp[i2 + 1][j2], dp[i2][j2 + 1]);
    }
  }
  const added = [];
  const removed = [];
  let unchanged = 0;
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      unchanged++;
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      removed.push(a[i]);
      i++;
    } else {
      added.push(b[j]);
      j++;
    }
  }
  while (i < a.length) removed.push(a[i++]);
  while (j < b.length) added.push(b[j++]);
  return { added, removed, unchanged, truncated: false };
}
function formatDiff(path, oldText, newText, maxLines = 40) {
  if (oldText === null) {
    const lines = newText.split("\n").filter((l) => l !== "").length;
    return `--- /dev/null
+++ ${path}
\uFF08\u65B0\u589E\u6A94\u6848\uFF0C\u5171 ${lines} \u884C\uFF09
` + newText.split("\n").slice(0, maxLines).map((l) => `+ ${l}`).join("\n");
  }
  const d = lineDiff(oldText, newText);
  if (d.truncated) {
    return `--- ${path}
+++ ${path}
${d.added.join("\n")}`;
  }
  if (d.added.length === 0 && d.removed.length === 0) {
    return `--- ${path}
+++ ${path}
\uFF08\u5167\u5BB9\u7121\u8B8A\u5316\uFF09`;
  }
  const head = `--- ${path}
+++ ${path}
\uFF08-${d.removed.length} \u884C / +${d.added.length} \u884C\uFF0C${d.unchanged} \u884C\u4E0D\u8B8A\uFF09`;
  const body = [
    ...d.removed.slice(0, maxLines).map((l) => `- ${l}`),
    ...d.added.slice(0, maxLines).map((l) => `+ ${l}`)
  ].join("\n");
  const more = d.removed.length + d.added.length > maxLines ? `
\u2026\uFF08\u5DEE\u7570\u592A\u591A\uFF0C\u53EA\u986F\u793A\u524D ${maxLines} \u884C\uFF09` : "";
  return `${head}
${body}${more}`;
}

// src/tools/paths.ts
import { isAbsolute, relative, resolve } from "node:path";
function resolveInWorkspace(workspace2, relPath) {
  const root = resolve(workspace2);
  const target = isAbsolute(relPath) ? resolve(relPath) : resolve(root, relPath);
  const rel = relative(root, target);
  if (rel.startsWith("..") || isAbsolute(rel)) {
    throw new Error(`\u8DEF\u5F91\u8D8A\u754C\uFF1A${relPath}\uFF08\u53EA\u53EF\u4EE5\u5B58\u53D6 workspace \u4E4B\u5167\u5605\u6A94\u6848\uFF09`);
  }
  return target;
}
function toDisplayPath(workspace2, absPath) {
  const rel = relative(resolve(workspace2), absPath);
  return rel === "" ? "." : rel;
}

// src/tools/catalog/fs-tools.ts
var MAX_READ_BYTES = 2e5;
var MAX_SEARCH_RESULTS = 80;
var MAX_WALK_FILES = 2e3;
function schema(properties, required = []) {
  return { type: "object", properties, required, additionalProperties: false };
}
var str = (description) => ({ type: "string", description });
function fsReadTool(workspace2) {
  return {
    name: "fs_read",
    label: "\u8B80\u6A94\u6848",
    description: "\u8B80\u53D6 workspace \u5167\u4E00\u500B\u6587\u5B57\u6A94\u6848\u5605\u5167\u5BB9",
    riskLevel: "read_only",
    parameters: schema({
      path: str("\u76F8\u5C0D\u65BC workspace \u5605\u6A94\u6848\u8DEF\u5F91"),
      maxBytes: { type: "number", description: "\u6700\u591A\u8B80\u5E7E\u591A byte\uFF08\u9810\u8A2D 200000\uFF09" }
    }, ["path"]),
    run(args) {
      const path = String(args.path ?? "");
      if (!path) return { ok: false, text: "\u7F3A\u5C11 path \u53C3\u6578" };
      const abs = resolveInWorkspace(workspace2, path);
      if (!existsSync(abs)) return { ok: false, text: `\u6A94\u6848\u5514\u5B58\u5728\uFF1A${path}` };
      const st = statSync(abs);
      if (st.isDirectory()) return { ok: false, text: `\u4FC2\u76EE\u9304\u5514\u4FC2\u6A94\u6848\uFF1A${path}\uFF08\u7528 fs_list\uFF09` };
      const limit = Number(args.maxBytes ?? MAX_READ_BYTES);
      const buf = readFileSync(abs);
      const slice = buf.subarray(0, limit);
      const text = slice.toString("utf8");
      const more = buf.length > limit ? `
\u2026\uFF08\u5DF2\u622A\u65B7\uFF0C\u5168\u6A94 ${buf.length} byte\uFF09` : "";
      return {
        ok: true,
        text: `\u{1F4C4} ${path}\uFF08${buf.length} byte\uFF09
${text}${more}`,
        details: { path, bytes: buf.length }
      };
    }
  };
}
function fsWriteTool(workspace2) {
  return {
    name: "fs_write",
    label: "\u5BEB\u6A94\u6848",
    description: "\u55BA workspace \u5167\u5EFA\u7ACB\u6216\u8986\u84CB\u4E00\u500B\u6587\u5B57\u6A94\u6848\uFF08\u6703\u5148\u554F\u7528\u6236\u78BA\u8A8D\uFF09",
    riskLevel: "write",
    parameters: schema({
      path: str("\u76F8\u5C0D\u65BC workspace \u5605\u6A94\u6848\u8DEF\u5F91"),
      content: str("\u5B8C\u6574\u6A94\u6848\u5167\u5BB9\uFF08\u6703\u8986\u84CB\u6574\u500B\u6A94\u6848\uFF09")
    }, ["path", "content"]),
    preview(args) {
      const path = String(args.path ?? "");
      const content = String(args.content ?? "");
      const abs = resolveInWorkspace(workspace2, path);
      const old = existsSync(abs) ? readFileSync(abs, "utf8") : null;
      return formatDiff(path, old, content);
    },
    run(args) {
      const path = String(args.path ?? "");
      const content = String(args.content ?? "");
      if (!path) return { ok: false, text: "\u7F3A\u5C11 path \u53C3\u6578" };
      const abs = resolveInWorkspace(workspace2, path);
      mkdirSync(dirname(abs), { recursive: true });
      writeFileSync(abs, content, "utf8");
      return {
        ok: true,
        text: `\u2705 \u5DF2\u5BEB\u5165 ${path}\uFF08${Buffer.byteLength(content, "utf8")} byte\uFF09`,
        details: { path, bytes: Buffer.byteLength(content, "utf8") }
      };
    }
  };
}
function fsListTool(workspace2) {
  return {
    name: "fs_list",
    label: "\u7747\u76EE\u9304",
    description: "\u5217\u51FA workspace \u5167\u67D0\u500B\u76EE\u9304\u5605\u5167\u5BB9",
    riskLevel: "read_only",
    parameters: schema({
      path: str("\u76F8\u5C0D\u65BC workspace \u5605\u76EE\u9304\u8DEF\u5F91\uFF08\u9810\u8A2D workspace \u6839\uFF09")
    }),
    run(args) {
      const path = String(args.path ?? ".");
      const abs = resolveInWorkspace(workspace2, path);
      if (!existsSync(abs)) return { ok: false, text: `\u76EE\u9304\u5514\u5B58\u5728\uFF1A${path}` };
      const entries = readdirSync(abs, { withFileTypes: true }).map((e) => {
        const size = e.isDirectory() ? 0 : statSync(join(abs, e.name)).size;
        return `${e.isDirectory() ? "\u{1F4C1}" : "\u{1F4C4}"} ${e.name}${e.isDirectory() ? "/" : `\uFF08${size} B\uFF09`}`;
      }).sort();
      return {
        ok: true,
        text: entries.length ? `\u{1F4C2} ${path}
${entries.join("\n")}` : `\u{1F4C2} ${path}\uFF08\u7A7A\uFF09`,
        details: { path, count: entries.length }
      };
    }
  };
}
function fsSearchTool(workspace2) {
  return {
    name: "fs_search",
    label: "\u641C\u5C0B\u6A94\u6848",
    description: "\u55BA workspace \u5167\u641C\u5C0B\u5305\u542B\u67D0\u6BB5\u6587\u5B57\u5605\u6A94\u6848\uFF08\u56DE\u50B3\u6A94\u6848\u540D + \u884C\u865F\uFF09",
    riskLevel: "read_only",
    parameters: schema({
      query: str("\u8981\u641C\u5C0B\u5605\u6587\u5B57"),
      path: str("\u9650\u5B9A\u55BA\u67D0\u500B\u76EE\u9304\uFF08\u9810\u8A2D\u5168\u90E8 workspace\uFF09"),
      maxResults: { type: "number", description: "\u6700\u591A\u56DE\u50B3\u5E7E\u591A\u500B\u7D50\u679C\uFF08\u9810\u8A2D 80\uFF09" }
    }, ["query"]),
    run(args) {
      const query = String(args.query ?? "");
      if (!query) return { ok: false, text: "\u7F3A\u5C11 query \u53C3\u6578" };
      const root = resolveInWorkspace(workspace2, String(args.path ?? "."));
      const limit = Number(args.maxResults ?? MAX_SEARCH_RESULTS);
      const needle = query.toLowerCase();
      const hits = [];
      let scanned = 0;
      const walk = (dir) => {
        if (scanned >= MAX_WALK_FILES || hits.length >= limit) return;
        let entries;
        try {
          entries = readdirSync(dir, { withFileTypes: true });
        } catch {
          return;
        }
        for (const e of entries) {
          if (hits.length >= limit || scanned >= MAX_WALK_FILES) return;
          if (e.name.startsWith(".") || e.name === "node_modules") continue;
          const full = join(dir, e.name);
          if (e.isDirectory()) {
            walk(full);
            continue;
          }
          let text;
          try {
            const st = statSync(full);
            if (st.size > MAX_READ_BYTES) continue;
            text = readFileSync(full, "utf8");
          } catch {
            continue;
          }
          scanned++;
          const lines = text.split("\n");
          for (let i = 0; i < lines.length && hits.length < limit; i++) {
            if (lines[i].toLowerCase().includes(needle)) {
              hits.push(`${toDisplayPath(workspace2, full)}:${i + 1}: ${lines[i].trim().slice(0, 160)}`);
            }
          }
        }
      };
      walk(root);
      return {
        ok: true,
        text: hits.length ? `\u{1F50D} \u300C${query}\u300D\u6435\u5230 ${hits.length} \u500B\u7D50\u679C\uFF08\u6383\u63CF ${scanned} \u500B\u6A94\u6848\uFF09
${hits.join("\n")}` : `\u{1F50D} \u300C${query}\u300D\u5187\u7D50\u679C\uFF08\u6383\u63CF ${scanned} \u500B\u6A94\u6848\uFF09`,
        details: { query, hits: hits.length, scanned }
      };
    }
  };
}

// src/tools/catalog/terminal-tool.ts
import { execFile } from "node:child_process";
var MAX_OUTPUT = 4e3;
var DEFAULT_TIMEOUT_MS = 6e4;
var BLACKLIST = [
  // rm 類：遞迴/強制 ＋ 目標係根目錄、家目錄、通配符（rm -rf ./build 呢種相對路徑唔會被擋）
  { re: /\brm\b[^\n]*-[a-z]*r[a-z]*[^\n]*(\s\/|\s~\b|\s\*|\$HOME)/i, why: "\u522A\u9664\u6839\u76EE\u9304\uFF0F\u5BB6\u76EE\u9304\uFF0F\u901A\u914D\u7B26" },
  { re: /\brm\b[^\n]*-[a-z]*f[a-z]*[^\n]*(\s\/|\s~\b|\s\*|\$HOME)/i, why: "\u5F37\u5236\u522A\u9664\u6839\u76EE\u9304\uFF0F\u5BB6\u76EE\u9304" },
  { re: /(^|[;&|]\s*|\s)sudo\s/i, why: "\u63D0\u6B0A\uFF08sudo\uFF09" },
  { re: /\b(shutdown|reboot|halt|poweroff)\b/i, why: "\u95DC\u6A5F\uFF0F\u91CD\u555F" },
  { re: /\bmkfs(\.\w+)?\b/i, why: "\u683C\u5F0F\u5316\u78C1\u789F" },
  { re: /\bdd\b[^\n]*\bof=\/dev\//i, why: "\u76F4\u63A5\u5BEB\u78C1\u789F" },
  { re: />\s*\/dev\/(sd|disk|nvme)/i, why: "\u5BEB\u5165\u78C1\u789F\u88DD\u7F6E" },
  { re: /\bchmod\s+(-R\s+)?777\s+\//i, why: "\u6539\u6839\u76EE\u9304\u6B0A\u9650" },
  { re: /\bchown\s+-R\s+[^\s]+\s+\//i, why: "\u6539\u6839\u76EE\u9304\u64C1\u6709\u8005" },
  { re: /\bkill(all)?\s+-9\s+1\b/i, why: "\u6BBA init \u7A0B\u5E8F" },
  { re: /:\(\)\s*\{\s*:\|:&\s*\}\s*;\s*:/, why: "fork bomb" },
  { re: /\b(curl|wget)\b[^|]*\|\s*(sudo\s+)?(sh|bash|zsh|python)\b/i, why: "\u9060\u7AEF\u8173\u672C\u76F4\u63A5\u57F7\u884C" },
  { re: /\bhistory\s+-c\b/i, why: "\u6E05\u6B77\u53F2" },
  { re: /\bdiskutil\s+(erase|reformat)/i, why: "\u62B9\u78C1\u789F" },
  { re: /\bnvram\s+erase/i, why: "\u6E05 NVRAM" },
  { re: /\bdefaults\s+delete\b/i, why: "\u6539\u7CFB\u7D71\u504F\u597D" },
  { re: /\bfind\b[^\n]*\s-delete\b/i, why: "\u6279\u91CF\u522A\u9664\uFF08find -delete\uFF09" },
  { re: /\bgit\s+push\b[^\n]*--force(?!-with-lease)/i, why: "\u5F37\u5236\u8986\u84CB\u9060\u7AEF\u5206\u652F" }
];
function checkCommand(command) {
  for (const rule of BLACKLIST) {
    if (rule.re.test(command)) return { allowed: false, why: rule.why };
  }
  return { allowed: true };
}
function truncate(text, max = MAX_OUTPUT) {
  if (text.length <= max) return text;
  const head = text.slice(0, Math.floor(max * 0.75));
  const tail = text.slice(-Math.floor(max * 0.2));
  const omitted = text.length - head.length - tail.length;
  return `${head}
\u2026\uFF08\u8F38\u51FA\u5DF2\u622A\u65B7\uFF0C\u7701\u7565 ${omitted} \u5B57\u5143\uFF09\u2026
${tail}`;
}
function terminalTool(workspace2) {
  return {
    name: "terminal",
    label: "\u57F7\u884C\u547D\u4EE4",
    description: "\u55BA workspace \u76EE\u9304\u57F7\u884C\u4E00\u689D shell \u547D\u4EE4\uFF08\u5371\u96AA\u547D\u4EE4\u6703\u88AB\u963B\u64CB\uFF1B\u57F7\u884C\u524D\u4E00\u5B9A\u6703\u554F\u7528\u6236\u78BA\u8A8D\uFF09",
    riskLevel: "external_effect",
    parameters: {
      type: "object",
      properties: {
        command: { type: "string", description: "\u8981\u57F7\u884C\u5605 shell \u547D\u4EE4" },
        timeoutMs: { type: "number", description: "\u8D85\u6642\u6BEB\u79D2\uFF08\u9810\u8A2D 60000\uFF0C\u4E0A\u9650 120000\uFF09" }
      },
      required: ["command"],
      additionalProperties: false
    },
    preview(args) {
      return `$ ${String(args.command ?? "")}
\uFF08\u55BA ${workspace2} \u57F7\u884C\uFF09`;
    },
    preflight(args) {
      const command = String(args.command ?? "").trim();
      if (!command) return { ok: false, text: "\u7F3A\u5C11 command \u53C3\u6578" };
      const check = checkCommand(command);
      if (!check.allowed) {
        return { ok: false, text: `\u{1F6AB} \u547D\u4EE4\u88AB\u5371\u96AA\u9598\u963B\u64CB\uFF1A${check.why}
$ ${command}` };
      }
      return { ok: true };
    },
    run(args) {
      const command = String(args.command ?? "").trim();
      if (!command) return { ok: false, text: "\u7F3A\u5C11 command \u53C3\u6578" };
      const timeout = Math.min(Number(args.timeoutMs ?? DEFAULT_TIMEOUT_MS), 12e4);
      return new Promise((resolve2) => {
        execFile(
          "/bin/sh",
          ["-c", command],
          { cwd: workspace2, timeout, maxBuffer: 10 * 1024 * 1024 },
          (err, stdout, stderr) => {
            const out = truncate(String(stdout ?? ""));
            const errOut = truncate(String(stderr ?? ""));
            if (err) {
              const killed = err.killed;
              const signal = err.signal;
              if (killed || signal === "SIGTERM") {
                resolve2({
                  ok: false,
                  text: `\u23F1 \u547D\u4EE4\u8D85\u6642\uFF08${timeout}ms\uFF09\u5DF2\u4E2D\u6B62
$ ${command}
${out}${errOut}`
                });
                return;
              }
              resolve2({
                ok: false,
                text: `\u274C \u547D\u4EE4\u5931\u6557\uFF08\u9000\u51FA\u78BC ${err.code ?? "?"}\uFF09
$ ${command}
${out}${errOut}`
              });
              return;
            }
            resolve2({
              ok: true,
              text: `$ ${command}
${out}${errOut}`.trimEnd(),
              details: { command, cwd: workspace2 }
            });
          }
        );
      });
    }
  };
}

// src/tools/catalog/index.ts
function createCatalogTools(workspace2) {
  return [
    fsReadTool(workspace2),
    fsListTool(workspace2),
    fsSearchTool(workspace2),
    fsWriteTool(workspace2),
    terminalTool(workspace2)
  ];
}

// src/tools/runtime.ts
function createToolRuntime(options) {
  const registry = new ToolRegistry();
  for (const tool of createCatalogTools(options.workspace)) registry.register(tool);
  let seq = 0;
  return {
    registry,
    confirms: new ConfirmStore(options.confirmTtlMs),
    audit: new AuditLog(),
    workspace: options.workspace,
    onConfirmRequest: options.onConfirmRequest,
    newConfirmId: () => `cf-${Date.now().toString(36)}-${++seq}`
  };
}

// src/relay-worker.ts
import { createAwsQueues, RelayClient } from "@voice-agent/relay";
var RelayWorker = class {
  constructor(client, deps) {
    this.client = client;
    this.deps = deps;
  }
  running = false;
  loopPromise = null;
  /** 執行中嘅任務（SQS at-least-once 可能重複投遞 → 唔好做兩次） */
  inFlight = /* @__PURE__ */ new Set();
  /** 開始輪詢（唔 block：喺背景跑） */
  start() {
    if (this.running) return;
    this.running = true;
    this.loopPromise = this.loop();
  }
  async stop() {
    this.running = false;
    await this.loopPromise?.catch(() => void 0);
  }
  /** 跑一個 poll cycle（測試用：可以同步等佢跑完一個 cycle） */
  async pollOnce() {
    await this.client.pollTasksConcurrent(async (task) => {
      if (this.inFlight.has(task.requestId)) {
        this.deps.log?.(`relay \u6536\u5230\u91CD\u8907\u4EFB\u52D9 ${task.requestId}\uFF08\u8DF3\u904E\uFF09`);
        return;
      }
      this.inFlight.add(task.requestId);
      this.deps.log?.(`relay \u6536\u5230\u4EFB\u52D9 ${task.requestId}\uFF1A${task.text.slice(0, 60)}`);
      try {
        const result = await this.deps.runTask(task.text, task.requestId);
        await this.client.publishResult({
          requestId: task.requestId,
          text: result.text,
          status: result.status,
          error: result.error
        });
        this.deps.log?.(`relay \u4EFB\u52D9 ${task.requestId} \u5B8C\u6210\uFF08${result.status}\uFF09`);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        this.deps.log?.(`relay \u4EFB\u52D9 ${task.requestId} \u5931\u6557\uFF1A${message}`);
        await this.client.publishResult({
          requestId: task.requestId,
          text: `\u4EFB\u52D9\u5931\u6557\uFF1A${message}`,
          status: "failed",
          error: message
        });
      } finally {
        this.inFlight.delete(task.requestId);
      }
    });
  }
  async loop() {
    while (this.running) {
      try {
        await this.pollOnce();
      } catch (err) {
        this.deps.log?.(`relay \u8F2A\u8A62\u932F\u8AA4\uFF1A${err instanceof Error ? err.message : String(err)}`);
        await new Promise((r) => setTimeout(r, 2e3));
      }
    }
  }
};
function createRelayClientFromEnv(env = process.env) {
  const tasksQueueUrl = env.TASKS_QUEUE_URL;
  const resultsQueueUrl = env.RESULTS_QUEUE_URL;
  const transcriptTable = env.TRANSCRIPT_TABLE;
  const taskTable = env.TASK_TABLE;
  if (!tasksQueueUrl || !resultsQueueUrl || !transcriptTable || !taskTable) return null;
  const userId = env.RELAY_USER_ID ?? "default";
  const aws = createAwsQueues({
    region: env.AWS_REGION ?? "ap-southeast-1",
    tasksQueueUrl,
    resultsQueueUrl,
    transcriptTable,
    taskTable,
    userId
  });
  return new RelayClient({ userId, ...aws });
}

// src/main.ts
function arg(name, fallback) {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.split("=")[1] : fallback;
}
var workspace = arg("workspace", process.env.VOICE_AGENT_WORKSPACE ?? process.cwd());
var SerialQueue = class {
  tail = Promise.resolve();
  run(task) {
    const result = this.tail.then(task, task);
    this.tail = result.then(
      () => void 0,
      () => void 0
    );
    return result;
  }
};
var serial = new SerialQueue();
var relayClient = createRelayClientFromEnv();
var currentRelayRequestId = null;
async function relayConfirm(requestId, confirmId) {
  if (!relayClient) return;
  const deadline = Date.now() + 5 * 60 * 1e3;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 2e3));
    try {
      const state = await relayClient.getTask(requestId);
      if (state?.confirm?.id !== confirmId) continue;
      const decision = state?.confirm?.decision;
      if (decision === "approved") {
        tools.confirms.approve(confirmId);
        return;
      }
      if (decision === "cancelled") {
        tools.confirms.cancel(confirmId);
        return;
      }
    } catch (err) {
      process.stderr.write(`[relay] \u67E5\u78BA\u8A8D\u72C0\u614B\u5931\u6557\uFF1A${err}
`);
    }
  }
  tools.confirms.expire(confirmId);
}
var tools = createToolRuntime({
  workspace,
  onConfirmRequest: (r) => {
    if (!relayClient || !currentRelayRequestId) {
      process.stdout.write(
        `${serializeMessage({
          type: "confirm_request",
          id: r.id,
          toolName: r.toolName,
          toolLabel: r.toolLabel,
          riskLevel: r.riskLevel,
          preview: r.preview,
          expiresAt: r.expiresAt
        })}
`
      );
      return;
    }
    const requestId = currentRelayRequestId;
    void (async () => {
      try {
        await relayClient.publishConfirm({
          requestId,
          confirm: {
            id: r.id,
            toolName: r.toolName,
            toolLabel: r.toolLabel,
            riskLevel: r.riskLevel,
            preview: r.preview,
            expiresAt: r.expiresAt
          }
        });
        process.stderr.write(`[relay] \u4EFB\u52D9 ${requestId} \u7B49\u7DCA\u78BA\u8A8D\uFF1A${r.toolName}
`);
        await relayConfirm(requestId, r.id);
      } catch (err) {
        process.stderr.write(`[relay] \u51FA\u78BA\u8A8D\u5361\u5931\u6557\uFF1A${err}
`);
        tools.confirms.cancel(r.id);
      }
    })();
  }
});
var host = new SessionHost({
  workspace,
  factory: createPiFactory({ toolRuntime: tools }),
  // 單任務預算（US-141）：超時／超 token → abort → partial → 通知
  budget: defaultBudgetFromEnv()
});
var pendingTasks = /* @__PURE__ */ new Map();
host.onMessage((m) => {
  process.stdout.write(`${serializeMessage(m)}
`);
  if (m.id && (m.type === "done" || m.type === "error" || m.type === "partial")) {
    const resolve2 = pendingTasks.get(m.id);
    if (resolve2) {
      pendingTasks.delete(m.id);
      resolve2({
        text: m.type === "done" ? m.text ?? "" : m.text ?? m.message ?? "",
        status: m.type === "done" ? "completed" : m.type === "partial" ? "partial" : "failed",
        error: m.type === "done" ? void 0 : m.message
      });
    }
  }
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
      await serial.run(() => host.prompt(req.text ?? "", req.id));
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
    case "list_tools": {
      process.stdout.write(
        `${serializeMessage({
          type: "log",
          id: req.id,
          event: "tools",
          data: tools.registry.list().map((t) => ({
            name: t.name,
            label: t.label,
            riskLevel: t.riskLevel
          }))
        })}
`
      );
      break;
    }
    case "audit_log": {
      process.stdout.write(
        `${serializeMessage({
          type: "log",
          id: req.id,
          event: "audit",
          data: tools.audit.list(100)
        })}
`
      );
      break;
    }
    case "confirm_response": {
      const confirmId = req.confirmId ?? req.id;
      if (!confirmId) break;
      const ok = req.approved === true ? tools.confirms.approve(confirmId) : tools.confirms.cancel(confirmId);
      if (!ok) {
        process.stdout.write(
          `${serializeMessage({ type: "error", id: req.id, message: "\u6435\u5514\u5230\u55F0\u5F35\u78BA\u8A8D\u5361\uFF08\u53EF\u80FD\u5DF2\u904E\u671F\uFF09" })}
`
        );
      }
      break;
    }
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
if (relayClient) {
  const worker = new RelayWorker(relayClient, {
    runTask: async (text, requestId) => {
      return new Promise((resolve2) => {
        pendingTasks.set(requestId, resolve2);
        void serial.run(() => {
          currentRelayRequestId = requestId;
          return host.prompt(text, requestId);
        }).catch((err) => {
          pendingTasks.delete(requestId);
          resolve2({
            text: `\u4EFB\u52D9\u5931\u6557\uFF1A${err instanceof Error ? err.message : String(err)}`,
            status: "failed",
            error: err instanceof Error ? err.message : String(err)
          });
        }).finally(() => {
          currentRelayRequestId = null;
        });
      });
    },
    log: (msg) => process.stderr.write(`[relay] ${msg}
`)
  });
  worker.start();
  process.stderr.write("[relay] worker \u5DF2\u555F\u52D5\uFF08\u8F2A\u8A62 tasks queue\uFF09\n");
}
