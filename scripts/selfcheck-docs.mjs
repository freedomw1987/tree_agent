/**
 * 文件層探針（Gate 3）：驗證 AC / 需求錨點 / 連結一致
 * 對應規則：backlog-rules.md §4.6（AC 範本 5 項自查）＋ §4.7（錨點 4 段 + R-ID 規則）
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
let fail = 0;
const check = (ok, label, extra = "") => {
  if (!ok) {
    console.log(`❌ ${label}${extra ? ` — ${extra}` : ""}`);
    fail += 1;
  }
};

const acIds = readdirSync(join(ROOT, "docs/ac"))
  .filter((f) => f.endsWith(".md"))
  .map((f) => f.replace(/\.md$/, ""));
const reqIds = readdirSync(join(ROOT, "docs/req"))
  .filter((f) => f.endsWith(".md"))
  .map((f) => f.replace(/-requirement\.md$/, ""));
const bl = readFileSync(join(ROOT, "docs/backlog.md"), "utf8");

for (const id of acIds) {
  check(existsSync(join(ROOT, "docs/ac", `${id}.html`)), `[1] ${id}.html 缺`);
  check(reqIds.includes(id), `[1] ${id} 缺需求錨點`);
}

for (const id of reqIds) {
  const t = readFileSync(join(ROOT, "docs/req", `${id}-requirement.md`), "utf8");
  for (const h of ["## 用戶原話（唯讀）", "## 澄清後驗收句", "## 變更歷史"]) {
    check(t.includes(h), `[2] ${id} 缺段落 ${h}`);
  }
  check(t.startsWith(`# ${id} 需求錨點`), `[2] ${id} 標題錯`);
  const orig = t.split("## 用戶原話（唯讀）")[1].split("## 澄清後驗收句")[0];
  const clar = t.split("## 澄清後驗收句")[1].split("## 變更歷史")[0];
  const oR = [...orig.matchAll(/- R(\d+): 「(.+)」/g)];
  const cR = [...clar.matchAll(/- R(\d+): (.+)/g)];
  check(oR.length === cR.length, `[3] ${id} R-ID 數量唔對`);
  oR.forEach((m, k) => {
    check(Number(m[1]) === k + 1, `[3] ${id} R-ID 唔連續`);
    check(cR[k]?.[1] === m[1], `[4] ${id} R-ID 集合唔一致`);
    check(m[2].trim().length > 0, `[5] ${id} R${m[1]} 原話空白`);
  });
}

for (const m of bl.matchAll(/\]\((ac\/[^)]+)\)/g)) {
  check(existsSync(join(ROOT, "docs", m[1])), `連結壞: ${m[1]}`);
}
for (const m of bl.matchAll(/\]\((req\/[^)]+)\)/g)) {
  check(existsSync(join(ROOT, "docs", m[1])), `連結壞: ${m[1]}`);
}
for (const id of acIds) {
  const h = readFileSync(join(ROOT, "docs/ac", `${id}.html`), "utf8");
  check(h.includes("@media print"), `CSS 缺 @media print: ${id}.html`);
}
for (const m of bl.matchAll(/^\| (SPIKE-\d+|M00-US-\d+|TECH-\d+) \|/gm)) {
  check(acIds.includes(m[1]), `backlog row 冇 AC 檔: ${m[1]}`);
  check(reqIds.includes(m[1]), `backlog row 冇錨點檔: ${m[1]}`);
}

console.log(
  fail === 0
    ? `✅ 文件探針全過（${acIds.length} 個項目 × 3 檔）`
    : `❌ 文件探針：${fail} 項失敗`,
);
process.exit(fail === 0 ? 0 : 1);
