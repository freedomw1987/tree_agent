#!/usr/bin/env node
/**
 * M03 sidecar entry —— stdio JSON lines IPC（Rust/Tauri ↔ Node）
 *
 * 用法：node dist/main.js --workspace ~/agent-workspace
 * 協定：見 src/protocol.ts
 */
import { createInterface } from "node:readline";
import { parseRequest, serializeMessage } from "./protocol";
import { SessionHost } from "./session-host";
import { createPiFactory } from "./pi-factory";
import { defaultBudgetFromEnv } from "./budget-guard";
import { AuditLog } from "./tools/audit-log";
import { ConfirmStore } from "./tools/confirm";
import { ToolRegistry } from "./tools/registry";

function arg(name: string, fallback: string): string {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.split("=")[1]! : fallback;
}

const workspace = arg("workspace", process.env.VOICE_AGENT_WORKSPACE ?? process.cwd());
const host = new SessionHost({
  workspace,
  factory: createPiFactory(),
  // 單任務預算（US-141）：超時／超 token → abort → partial → 通知
  budget: defaultBudgetFromEnv(),
});

// M04 工具治理層（風險閘 ＋ 確認 ＋ audit log）
const registry = new ToolRegistry();
const confirms = new ConfirmStore();
const audit = new AuditLog();

host.onMessage((m) => {
  process.stdout.write(`${serializeMessage(m)}\n`);
});

const rl = createInterface({ input: process.stdin });

rl.on("line", async (line) => {
  if (!line.trim()) return;
  let req;
  try {
    req = parseRequest(line);
  } catch (err) {
    process.stdout.write(
      `${serializeMessage({ type: "error", message: `壞 request：${(err as Error).message}` })}\n`,
    );
    return;
  }

  switch (req.type) {
    case "status":
      process.stdout.write(
        `${serializeMessage({
          type: "ready",
          sessionId: host.listSessions().find((s) => s.current)?.sessionId,
          workspace,
        })}\n`,
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
    case "list_tools": {
      process.stdout.write(
        `${serializeMessage({
          type: "log",
          id: req.id,
          event: "tools",
          data: registry.list().map((t) => ({
            name: t.name,
            label: t.label,
            riskLevel: t.riskLevel,
          })),
        })}\n`,
      );
      break;
    }
    case "audit_log": {
      process.stdout.write(
        `${serializeMessage({
          type: "log",
          id: req.id,
          event: "audit",
          data: audit.list(100),
        })}\n`,
      );
      break;
    }
    case "confirm_response": {
      // 前端回覆確認卡（撳「確認」／語音講「confirm」都會走到呢度）
      const confirmId = req.confirmId ?? req.id;
      if (!confirmId) break;
      const ok = req.approved === true ? confirms.approve(confirmId) : confirms.cancel(confirmId);
      if (!ok) {
        process.stdout.write(
          `${serializeMessage({ type: "error", id: req.id, message: "搵唔到嗰張確認卡（可能已過期）" })}\n`,
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
