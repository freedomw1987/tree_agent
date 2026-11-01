import { execFile } from "node:child_process";
import type { ToolSpec } from "../types";

/**
 * M05 Terminal 工具（危險命令閘）
 *  - 黑名單：破壞性／提權／遠端執行類命令直接拒絕
 *  - 60 秒超時：到時 kill 個 process
 *  - 輸出截斷：頭尾各留一部分，避免 context 爆
 */

const MAX_OUTPUT = 4000;
const DEFAULT_TIMEOUT_MS = 60_000;

/** 危險命令黑名單（regex） */
const BLACKLIST: Array<{ re: RegExp; why: string }> = [
  // rm 類：遞迴/強制 ＋ 目標係根目錄、家目錄、通配符（rm -rf ./build 呢種相對路徑唔會被擋）
  { re: /\brm\b[^\n]*-[a-z]*r[a-z]*[^\n]*(\s\/|\s~\b|\s\*|\$HOME)/i, why: "刪除根目錄／家目錄／通配符" },
  { re: /\brm\b[^\n]*-[a-z]*f[a-z]*[^\n]*(\s\/|\s~\b|\s\*|\$HOME)/i, why: "強制刪除根目錄／家目錄" },
  { re: /(^|[;&|]\s*|\s)sudo\s/i, why: "提權（sudo）" },
  { re: /\b(shutdown|reboot|halt|poweroff)\b/i, why: "關機／重啟" },
  { re: /\bmkfs(\.\w+)?\b/i, why: "格式化磁碟" },
  { re: /\bdd\b[^\n]*\bof=\/dev\//i, why: "直接寫磁碟" },
  { re: />\s*\/dev\/(sd|disk|nvme)/i, why: "寫入磁碟裝置" },
  { re: /\bchmod\s+(-R\s+)?777\s+\//i, why: "改根目錄權限" },
  { re: /\bchown\s+-R\s+[^\s]+\s+\//i, why: "改根目錄擁有者" },
  { re: /\bkill(all)?\s+-9\s+1\b/i, why: "殺 init 程序" },
  { re: /:\(\)\s*\{\s*:\|:&\s*\}\s*;\s*:/, why: "fork bomb" },
  { re: /\b(curl|wget)\b[^|]*\|\s*(sudo\s+)?(sh|bash|zsh|python)\b/i, why: "遠端腳本直接執行" },
  { re: /\bhistory\s+-c\b/i, why: "清歷史" },
  { re: /\bdiskutil\s+(erase|reformat)/i, why: "抹磁碟" },
  { re: /\bnvram\s+erase/i, why: "清 NVRAM" },
  { re: /\bdefaults\s+delete\b/i, why: "改系統偏好" },
  { re: /\bfind\b[^\n]*\s-delete\b/i, why: "批量刪除（find -delete）" },
  { re: /\bgit\s+push\b[^\n]*--force(?!-with-lease)/i, why: "強制覆蓋遠端分支" },
];

/** 檢查命令是否被黑名單阻擋 */
export function checkCommand(command: string): { allowed: true } | { allowed: false; why: string } {
  for (const rule of BLACKLIST) {
    if (rule.re.test(command)) return { allowed: false, why: rule.why };
  }
  return { allowed: true };
}

function truncate(text: string, max = MAX_OUTPUT): string {
  if (text.length <= max) return text;
  const head = text.slice(0, Math.floor(max * 0.75));
  const tail = text.slice(-Math.floor(max * 0.2));
  const omitted = text.length - head.length - tail.length;
  return `${head}\n…（輸出已截斷，省略 ${omitted} 字元）…\n${tail}`;
}

export function terminalTool(workspace: string): ToolSpec {
  return {
    name: "terminal",
    label: "執行命令",
    description:
      "喺 workspace 目錄執行一條 shell 命令（危險命令會被阻擋；執行前一定會問用戶確認）",
    riskLevel: "external_effect",
    parameters: {
      type: "object",
      properties: {
        command: { type: "string", description: "要執行嘅 shell 命令" },
        timeoutMs: { type: "number", description: "超時毫秒（預設 60000，上限 120000）" },
      },
      required: ["command"],
      additionalProperties: false,
    },
    preview(args) {
      return `$ ${String(args.command ?? "")}\n（喺 ${workspace} 執行）`;
    },
    preflight(args) {
      const command = String(args.command ?? "").trim();
      if (!command) return { ok: false, text: "缺少 command 參數" };
      const check = checkCommand(command);
      if (!check.allowed) {
        return { ok: false, text: `🚫 命令被危險閘阻擋：${check.why}\n$ ${command}` };
      }
      return { ok: true };
    },
    run(args) {
      const command = String(args.command ?? "").trim();
      if (!command) return { ok: false, text: "缺少 command 參數" };

      const timeout = Math.min(Number(args.timeoutMs ?? DEFAULT_TIMEOUT_MS), 120_000);
      return new Promise((resolve) => {
        execFile(
          "/bin/sh",
          ["-c", command],
          { cwd: workspace, timeout, maxBuffer: 10 * 1024 * 1024 },
          (err, stdout, stderr) => {
            const out = truncate(String(stdout ?? ""));
            const errOut = truncate(String(stderr ?? ""));
            if (err) {
              const killed = (err as NodeJS.ErrnoException & { killed?: boolean }).killed;
              const signal = (err as { signal?: string }).signal;
              if (killed || signal === "SIGTERM") {
                resolve({
                  ok: false,
                  text: `⏱ 命令超時（${timeout}ms）已中止\n$ ${command}\n${out}${errOut}`,
                });
                return;
              }
              resolve({
                ok: false,
                text: `❌ 命令失敗（退出碼 ${(err as { code?: number }).code ?? "?"}）\n$ ${command}\n${out}${errOut}`,
              });
              return;
            }
            resolve({
              ok: true,
              text: `$ ${command}\n${out}${errOut}`.trimEnd(),
              details: { command, cwd: workspace },
            });
          },
        );
      });
    },
  };
}
