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
import { createToolRuntime } from "./tools/runtime";
import { createRelayClientFromEnv, RelayWorker } from "./relay-worker";

function arg(name: string, fallback: string): string {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.split("=")[1]! : fallback;
}

const workspace = arg("workspace", process.env.VOICE_AGENT_WORKSPACE ?? process.cwd());

/**
 * 序列化執行隊列
 *
 * Pi SDK 嘅 session 同一時間只可以跑一個 prompt（第二次會報
 * "Agent is already processing"），所以所有任務（本地 IPC ＋ relay）都經呢條隊列，
 * 一個接一個跑。
 */
class SerialQueue {
  private tail: Promise<unknown> = Promise.resolve();

  run<T>(task: () => Promise<T>): Promise<T> {
    const result = this.tail.then(task, task);
    // 就算上一個 task 爆咗，都要繼續行下一個
    this.tail = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }
}

const serial = new SerialQueue();

// M02 relay client（有環境變數就有 → 手機可以派任務過嚟）
const relayClient = createRelayClientFromEnv();
// 而家執行緊嘅 relay 任務（確認卡要掛喺佢名下）
let currentRelayRequestId: string | null = null;

/** 跨機確認：出卡去 relay ＋ 輪詢等手機回覆 */
async function relayConfirm(requestId: string, confirmId: string): Promise<void> {
  if (!relayClient) return;
  const deadline = Date.now() + 5 * 60 * 1000;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 2000));
    try {
      const state = await relayClient.getTask(requestId);
      // 只認同一張卡嘅決定（Agent 出咗新卡就等新卡）
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
      process.stderr.write(`[relay] 查確認狀態失敗：${err}\n`);
    }
  }
  tools.confirms.expire(confirmId);
}

// M04 + M05 工具 runtime（registry ＋ 確認 ＋ audit log）
const tools = createToolRuntime({
  workspace,
  onConfirmRequest: (r) => {
    // 本地模式：確認卡經 stdio IPC 送去做 App（Tauri）
    if (!relayClient || !currentRelayRequestId) {
      process.stdout.write(
        `${serializeMessage({
          type: "confirm_request",
          id: r.id,
          toolName: r.toolName,
          toolLabel: r.toolLabel,
          riskLevel: r.riskLevel,
          preview: r.preview,
          expiresAt: r.expiresAt,
        })}\n`,
      );
      return;
    }
    // 跨機模式：確認卡經 relay 去手機，回覆再經 relay 返嚟
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
            expiresAt: r.expiresAt,
          },
        });
        process.stderr.write(`[relay] 任務 ${requestId} 等緊確認：${r.toolName}\n`);
        await relayConfirm(requestId, r.id);
      } catch (err) {
        process.stderr.write(`[relay] 出確認卡失敗：${err}\n`);
        tools.confirms.cancel(r.id);
      }
    })();
  },
});

const host = new SessionHost({
  workspace,
  factory: createPiFactory({ toolRuntime: tools }),
  // 單任務預算（US-141）：超時／超 token → abort → partial → 通知
  budget: defaultBudgetFromEnv(),
});

// relay 任務 → 本地 session 嘅結果收集（每個 requestId 一個 pending）
type TaskResult = { text: string; status: "completed" | "failed" | "partial"; error?: string };
const pendingTasks = new Map<string, (r: TaskResult) => void>();

host.onMessage((m) => {
  process.stdout.write(`${serializeMessage(m)}\n`);
  if (m.id && (m.type === "done" || m.type === "error" || m.type === "partial")) {
    const resolve = pendingTasks.get(m.id);
    if (resolve) {
      pendingTasks.delete(m.id);
      resolve({
        text: m.type === "done" ? (m.text ?? "") : (m.text ?? m.message ?? ""),
        status: m.type === "done" ? "completed" : m.type === "partial" ? "partial" : "failed",
        error: m.type === "done" ? undefined : m.message,
      });
    }
  }
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
          data: tools.audit.list(100),
        })}\n`,
      );
      break;
    }
    case "confirm_response": {
      // 前端回覆確認卡（撳「確認」／語音講「confirm」都會走到呢度）
      const confirmId = req.confirmId ?? req.id;
      if (!confirmId) break;
      const ok =
        req.approved === true
          ? tools.confirms.approve(confirmId)
          : tools.confirms.cancel(confirmId);
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

// ── M02 relay worker（有環境變數就開：手機 App 派任務 → 呢度執行）──
if (relayClient) {
  const worker = new RelayWorker(relayClient, {
    runTask: async (text: string, requestId: string): Promise<TaskResult> => {
      return new Promise<TaskResult>((resolve) => {
        pendingTasks.set(requestId, resolve);
        void serial.run(() => {
          // 真正開始跑先掛 requestId（排隊中唔可以掛，否則會蓋咗前一個任務嘅）
          currentRelayRequestId = requestId;
          return host.prompt(text, requestId);
        })
          .catch((err: unknown) => {
            pendingTasks.delete(requestId);
            resolve({
              text: `任務失敗：${err instanceof Error ? err.message : String(err)}`,
              status: "failed",
              error: err instanceof Error ? err.message : String(err),
            });
          })
          .finally(() => {
            currentRelayRequestId = null;
          });
      });
    },
    log: (msg) => process.stderr.write(`[relay] ${msg}\n`),
  });
  worker.start();
  process.stderr.write("[relay] worker 已啟動（輪詢 tasks queue）\n");
}
