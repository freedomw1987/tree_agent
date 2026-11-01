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

function arg(name: string, fallback: string): string {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.split("=")[1]! : fallback;
}

const workspace = arg("workspace", process.env.VOICE_AGENT_WORKSPACE ?? process.cwd());
const host = new SessionHost({ workspace, factory: createPiFactory() });

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
