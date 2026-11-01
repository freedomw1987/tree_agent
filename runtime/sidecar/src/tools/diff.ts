/**
 * 簡單行級 diff（用嚟做寫檔案嘅確認卡預覽）
 * LCS 動態規劃；行數太多就唔逐行比對，只報統計。
 */
export interface DiffResult {
  added: string[];
  removed: string[];
  unchanged: number;
  truncated: boolean;
}

const MAX_LINES = 1200;

export function lineDiff(oldText: string, newText: string): DiffResult {
  const a = oldText.split("\n");
  const b = newText.split("\n");
  if (a.length > MAX_LINES || b.length > MAX_LINES) {
    return {
      added: [`（檔案太長（${a.length} → ${b.length} 行），只顯示統計）`],
      removed: [],
      unchanged: 0,
      truncated: true,
    };
  }

  // LCS 表
  const dp: number[][] = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  const added: string[] = [];
  const removed: string[] = [];
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

/** 做成確認卡用嘅文字預覽 */
export function formatDiff(
  path: string,
  oldText: string | null,
  newText: string,
  maxLines = 40,
): string {
  if (oldText === null) {
    const lines = newText.split("\n").filter((l) => l !== "").length;
    return `--- /dev/null\n+++ ${path}\n（新增檔案，共 ${lines} 行）\n` +
      newText.split("\n").slice(0, maxLines).map((l) => `+ ${l}`).join("\n");
  }
  const d = lineDiff(oldText, newText);
  if (d.truncated) {
    return `--- ${path}\n+++ ${path}\n${d.added.join("\n")}`;
  }
  if (d.added.length === 0 && d.removed.length === 0) {
    return `--- ${path}\n+++ ${path}\n（內容無變化）`;
  }
  const head = `--- ${path}\n+++ ${path}\n（-${d.removed.length} 行 / +${d.added.length} 行，${d.unchanged} 行不變）`;
  const body = [
    ...d.removed.slice(0, maxLines).map((l) => `- ${l}`),
    ...d.added.slice(0, maxLines).map((l) => `+ ${l}`),
  ].join("\n");
  const more =
    d.removed.length + d.added.length > maxLines
      ? `\n…（差異太多，只顯示前 ${maxLines} 行）`
      : "";
  return `${head}\n${body}${more}`;
}
