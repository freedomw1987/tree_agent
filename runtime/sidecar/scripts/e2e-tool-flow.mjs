#!/usr/bin/env node
/**
 * M05 端到端驗證（真 Pi SDK + 真工具 + 真確認流程）
 *
 * 步驟：
 *  1. 起 sidecar（temp workspace）
 *  2. 派任務：「幫我寫一個 hello.txt，內容寫 hi」
 *  3. 等 confirm_request 出現（Agent 調用咗 fs_write）
 *  4. 批核 → 檔案應該真係出現
 *  5. 順便睇 audit log 有冇記錄
 */
import { spawn } from "node:child_process";
import { mkdtempSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const ws = mkdtempSync(join(tmpdir(), "va-e2e-"));
const sidecar = spawn(process.execPath, ["dist/main.mjs", `--workspace=${ws}`], {
  cwd: process.cwd(),
  stdio: ["pipe", "pipe", "inherit"],
});

let buffer = "";
const seen = { confirm: null, done: false, chunks: [], errors: [], audit: [], confirmCount: 0 };

sidecar.stdout.on("data", (d) => {
  buffer += d.toString();
  let idx;
  while ((idx = buffer.indexOf("\n")) >= 0) {
    const line = buffer.slice(0, idx).trim();
    buffer = buffer.slice(idx + 1);
    if (!line) continue;
    let msg;
    try {
      msg = JSON.parse(line);
    } catch {
      continue;
    }
    if (msg.type === "chunk") seen.chunks.push(msg.text ?? "");
    if (msg.type === "done") seen.done = true;
    if (msg.type === "error") seen.errors.push(msg.message);
    if (msg.event === "audit") seen.audit = msg.data ?? [];
    if (msg.type === "confirm_request") {
      seen.confirmCount += 1;
      if (!seen.confirm) seen.confirm = msg;
      console.log("🛡️  收到確認卡：", msg.toolName, "|", msg.riskLevel);
      console.log("    預覽：", String(msg.preview).split("\n").slice(0, 4).join(" / "));
      // 批核
      sidecar.stdin.write(
        JSON.stringify({ type: "confirm_response", confirmId: msg.id, approved: true }) + "\n",
      );
      console.log("    ✅ 已批核");
    }
  }
});

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

console.log(`📁 workspace：${ws}`);
await wait(1500);
console.log("📨 派任務：寫一個 hello.txt");
sidecar.stdin.write(
  JSON.stringify({
    type: "prompt",
    id: "e2e-1",
    text: "請用 fs_write 工具喺 workspace 根目錄建立一個叫 hello.txt 嘅檔案，內容寫「hi」",
  }) + "\n",
);

// 等確認卡 + 完成
for (let i = 0; i < 120 && !seen.done; i++) await wait(500);
await wait(500);

// ── 第二段：read_only 工具應該自動執行（唔出確認卡）────────────
const confirmBefore = seen.confirmCount;
seen.done = false;
seen.chunks = [];
console.log("\n📨 派任務：讀返個檔案（read_only 應該自動執行）");
sidecar.stdin.write(
  JSON.stringify({
    type: "prompt",
    id: "e2e-2",
    text: "請用 fs_read 工具讀取 hello.txt，同我講出內容",
  }) + "\n",
);
for (let i = 0; i < 120 && !seen.done; i++) await wait(500);
await wait(500);
const autoRan = seen.confirmCount === confirmBefore;
console.log(`  read_only 自動執行（冇確認卡）：${autoRan ? "✅" : "❌"}`);

// Audit log
sidecar.stdin.write(JSON.stringify({ type: "audit_log", id: "audit-1" }) + "\n");
await wait(1200);
sidecar.stdin.write(JSON.stringify({ type: "shutdown", id: "bye" }) + "\n");
await wait(600);

const filePath = join(ws, "hello.txt");
console.log("\n══════ 結果 ══════");
console.log("確認卡出現：", seen.confirm ? "✅" : "❌");
console.log("檔案存在：", existsSync(filePath) ? "✅" : "❌");
if (existsSync(filePath)) console.log("檔案內容：", JSON.stringify(readFileSync(filePath, "utf8")));
console.log("Agent 回覆：", seen.chunks.join("").slice(0, 200));
if (seen.errors.length) console.log("錯誤：", seen.errors);
console.log("完成訊息：", seen.done ? "✅" : "❌");

console.log("\n📋 audit log：");
for (const e of seen.audit.slice(0, 6)) {
  console.log(`  · ${e.tool} [${e.riskLevel}] → ${e.outcome}  args=${e.argsDigest}`);
}
console.log("⚠️ 只准 audit 見到 fs_write（write）同 fs_read（read_only）");
const ok = seen.confirm && existsSync(filePath) && autoRan;
console.log(ok ? "\n🎉 M05 端到端通過" : "\n❌ 未通過");
process.exit(ok ? 0 : 1);
