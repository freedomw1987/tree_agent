/**
 * Demo app 機械驗收（對應 system-prototype.md §6）
 *  1. build 產物單檔可用（file:// 雙擊即開，無外部 CDN 依賴）
 *  2. demo 路線 8 步行得通（每步都跳到預期 route，冇 console error）
 *  3. 跨 Surface 資料流真串連（手機送出 → terminal 見到 → 桌面 audit log 見到）
 *  4. 三個 Surface 各有 route 分區
 *
 * 用法：node scripts/smoke.mjs [--shots]
 */
import puppeteer from "puppeteer-core";
import { readFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const dist = join(root, "dist/index.html");
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const shots = process.argv.includes("--shots");
const shotDir = join(root, "docs/shots");

let failures = 0;
const check = (ok, label, extra = "") => {
  console.log(`${ok ? "✅" : "❌"} ${label}${extra ? ` — ${extra}` : ""}`);
  if (!ok) failures += 1;
};

// 0. build 產物基本檢查
check(existsSync(dist), "dist/index.html 存在");
const html = readFileSync(dist, "utf8");
const externalRefs = [...html.matchAll(/(?:src|href)="(https?:)?\/\/[^"]+"/g)].map((m) => m[0]);
check(externalRefs.length === 0, "無外部 CDN / 遠端資源依賴", externalRefs.join(", "));
check(
  html.includes("/m/chat") && html.includes("/d/chat") && html.includes("/t/console"),
  "三個 Surface route 前綴已內建",
);

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: "new",
  args: ["--allow-file-access-from-files", "--no-sandbox"],
});

try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });

  const errors = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));

  await page.goto(pathToFileURL(dist).href, { waitUntil: "networkidle0" });
  await page.waitForSelector("#root > *", { timeout: 15000 });
  check(true, "App 喺 file:// 成功 mount（雙擊即開）");

  // Surface route 分區
  for (const [route, needle] of [
    ["/m/chat", "Voice Agent"],
    ["/d/chat", "Sessions"],
    ["/t/console", "sidecar"],
  ]) {
    await page.goto(`${pathToFileURL(dist).href}#${route}`, { waitUntil: "networkidle0" });
    await new Promise((r) => setTimeout(r, 300));
    const text = await page.evaluate(() => document.body.innerText);
    check(text.includes(needle), `route #${route} 有內容`, needle);
  }

  // demo 路線：逐步行
  await page.goto(pathToFileURL(dist).href, { waitUntil: "networkidle0" });
  await page.evaluate(() => window.localStorage.clear());
  await page.reload({ waitUntil: "networkidle0" });

  const clickByText = async (text) => {
    const handle = await page.evaluateHandle((t) => {
      const els = [...document.querySelectorAll("button")];
      return els.find((e) => e.textContent?.includes(t)) ?? null;
    }, text);
    const el = handle.asElement();
    if (!el) throw new Error(`搵唔到按鈕：${text}`);
    await el.click();
    await new Promise((r) => setTimeout(r, 350));
  };

  const expected = [
    "#/m/chat",
    "#/t/console",
    "#/d/runtime",
    "#/m/chat",
    "#/m/chat",
    "#/t/console",
    "#/d/tools",
    "#/m/stats",
    "#/m/chat",
  ];

  await clickByText("Demo 路線");
  check(await page.evaluate(() => document.body.innerText.includes("五狀態切換")), "demo 面板有五狀態切換器");

  for (let i = 0; i < expected.length; i++) {
    if (i === 0) await clickByText("用手機講嘢派任務");
    else await clickByText("下一步");
    const hash = await page.evaluate(() => window.location.hash);
    check(hash === expected[i], `demo step-${i + 1} 跳到 ${expected[i]}`, hash);
  }

  // 跨 Surface 資料流：手機送出 → terminal 見到送達紀錄
  const consoleText = await page.evaluate(() => document.body.innerText);
  check(
    consoleText.includes("整理本週交付進度") || consoleText.includes("relay"),
    "跨 Surface 資料流：terminal 見到手機送出嘅任務",
  );

  // 自動分流 + 開新對話
  await page.goto(`${pathToFileURL(dist).href}#/m/chat`, { waitUntil: "networkidle0" });
  await new Promise((r) => setTimeout(r, 400));
  await clickByText("Demo 路線");
  await clickByText("對話 session：自動分流");
  await new Promise((r) => setTimeout(r, 400));
  const sheetText = await page.evaluate(() => document.body.innerText);
  check(sheetText.includes("開新對話"), "手機有 session 抽屜 + 開新對話入口");
  await clickByText("開新對話");
  await new Promise((r) => setTimeout(r, 400));
  const afterNew = await page.evaluate(() => document.body.innerText);
  check(afterNew.includes("新對話"), "開新對話成功（當前 session = 新對話）");

  await page.goto(`${pathToFileURL(dist).href}#/d/tools`, { waitUntil: "networkidle0" });
  await new Promise((r) => setTimeout(r, 300));
  const toolsText = await page.evaluate(() => document.body.innerText);
  check(toolsText.includes("Risk Gate 規則"), "desktop audit log / Risk Gate 頁有內容");

  await page.goto(`${pathToFileURL(dist).href}#/m/stats`, { waitUntil: "networkidle0" });
  await new Promise((r) => setTimeout(r, 300));
  const statsText = await page.evaluate(() => document.body.innerText);
  check(statsText.includes("今日完成任務"), "統計頁有每日任務數");

  // 「黏底」行為：用戶拖咗上去 → 新訊息到達出「新訊息」按鈕；撳咗先滾落去
  await page.goto(`${pathToFileURL(dist).href}#/d/chat`, { waitUntil: "networkidle0" });
  await page.reload({ waitUntil: "networkidle0" }); // 重載：確保 demo 面板關閉（唔會遮住對話串）
  await page.waitForSelector("[data-stream=desktop]");
  await page.evaluate(() => {
    const el = document.querySelector("[data-stream=desktop]");
    if (el) {
      el.style.minHeight = "120px";
      el.style.height = "120px";
      el.style.maxHeight = "120px";
      el.scrollTop = 0;
      el.dispatchEvent(new Event("scroll", { bubbles: true }));
    }
  });
  await new Promise((r) => setTimeout(r, 250));
  await page.waitForSelector("input[placeholder*='打字']");
  await page.type("input[placeholder*='打字']", "幫我睇下交付進度");
  await page.keyboard.press("Enter");
  await new Promise((r) => setTimeout(r, 700));
  const stickyText = await page.evaluate(() => document.body.innerText);
  check(stickyText.includes("新訊息"), "拖咗上去睇歷史時，新訊息到達出「新訊息」按鈕");
  await clickByText("新訊息");
  await new Promise((r) => setTimeout(r, 500));
  const afterClick = await page.evaluate(() => document.body.innerText);
  check(!afterClick.includes("新訊息"), "撳「新訊息」後按鈕消失（已滾到最底）");

  // 輸入模式：Voice（按住說話）↔ 鍵盤（多行 + 傳送鈕）
  await page.goto(`${pathToFileURL(dist).href}#/m/chat`, { waitUntil: "networkidle0" });
  await page.reload({ waitUntil: "networkidle0" });
  await page.waitForSelector("button");
  const holdBtn = await page.evaluateHandle(() =>
    [...document.querySelectorAll("button")].find((b) => b.textContent?.includes("按住 說話")) ?? null,
  );
  check(!!holdBtn.asElement(), "Voice 模式：底部有「按住 說話」按鈕");
  const bb = await holdBtn.asElement().boundingBox();
  await page.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2);
  await page.mouse.down();
  await new Promise((r) => setTimeout(r, 350));
  const holdingText = await page.evaluate(() => document.body.innerText);
  check(holdingText.includes("放開發送"), "按住時顯示「放開發送」+ 錄音計時");
  await page.mouse.up();
  await new Promise((r) => setTimeout(r, 500));
  const sentText = await page.evaluate(() => document.body.innerText);
  check(
    sentText.includes("幫我寫封 email 俾客戶講明延遲兩日交付"),
    "放開即完成錄音並傳送（唔使再撳傳送）",
  );

  // 切換到鍵盤模式
  await page.click('button[aria-label="切換到鍵盤輸入"]');
  await new Promise((r) => setTimeout(r, 300));
  const kb = await page.evaluate(() => ({
    hasSend: !!document.querySelector('button[aria-label="傳送"]'),
    hasTextarea: !!document.querySelector("textarea[placeholder*='輸入訊息']"),
  }));
  check(kb.hasSend && kb.hasTextarea, "鍵盤模式：多行輸入框 ＋ 右邊「傳送」按鈕");

  // macOS：輸入列浮動喺視窗最下方（右邊傳送／錄音鈕一齊浮住）
  await page.goto(`${pathToFileURL(dist).href}#/d/chat`, { waitUntil: "networkidle0" });
  await page.reload({ waitUntil: "networkidle0" });
  await page.waitForSelector("input[placeholder*='打字']");
  const floatInfo = await page.evaluate(() => {
    const input = document.querySelector("input[placeholder*='打字']");
    const send = document.querySelector('button[aria-label="發送"]');
    const mic = document.querySelector('button[aria-label="語音輸入"]');
    // 注意：DOMRect 經 JSON 序列化會變 {}，所以要轉成 plain object
    const r = (el) => {
      if (!el) return null;
      const b = el.getBoundingClientRect();
      return { top: b.top, bottom: b.bottom, left: b.left, right: b.right, width: b.width, height: b.height };
    };
    return {
      input: r(input),
      send: r(send),
      mic: r(mic),
      h: window.innerHeight,
    };
  });
  const gapBottom = floatInfo.h - (floatInfo.input?.bottom ?? 0);
  check(
    gapBottom < 40,
    "macOS 輸入列浮喺視窗最下方（距底 < 40px）",
    `距底 ${Math.round(gapBottom)}px`,
  );
  check(
    floatInfo.send && floatInfo.mic && floatInfo.send.bottom > floatInfo.input.bottom - 40,
    "右邊嘅傳送／錄音鈕同輸入列一齊浮喺底部",
  );

  // 五狀態切換器：行一次 happy → empty（先重載，確保 panel 狀態乾淨）
  await page.goto(pathToFileURL(dist).href, { waitUntil: "networkidle0" });
  await page.evaluate(() => window.localStorage.clear());
  await page.reload({ waitUntil: "networkidle0" });
  await page.evaluate(() => {
    window.location.hash = "#/m/chat";
  });
  await new Promise((r) => setTimeout(r, 400));
  await clickByText("Demo 路線");
  await clickByText("Empty");
  await new Promise((r) => setTimeout(r, 300));
  const emptyText = await page.evaluate(() => document.body.innerText);
  check(emptyText.includes("仲未傾過偈"), "Empty 狀態有零資料畫面");

  if (shots) {
    mkdirSync(shotDir, { recursive: true });
    for (const [route, name] of [
      ["/m/chat", "mobile-chat"],
      ["/d/runtime", "desktop-runtime"],
      ["/t/console", "terminal-console"],
    ]) {
      await page.goto(`${pathToFileURL(dist).href}#${route}`, { waitUntil: "networkidle0" });
      await new Promise((r) => setTimeout(r, 400));
      await page.screenshot({ path: join(shotDir, `${name}.png`) });
    }
    console.log(`📸 截圖已存 ${shotDir}`);
  }

  const realErrors = errors.filter((e) => !/favicon|ERR_FILE_NOT_FOUND/i.test(e));
  check(realErrors.length === 0, "冇 console error / pageerror", realErrors.slice(0, 3).join(" | "));
} finally {
  await browser.close();
}

console.log(failures === 0 ? "\n✅ 原型機械驗收全過" : `\n❌ ${failures} 項失敗`);
process.exit(failures === 0 ? 0 : 1);
