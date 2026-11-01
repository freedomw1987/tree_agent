# Voice Agent App — 系統 Demo 原型

> 設計期原型（dav-designer Step 5）｜Surface 單位：每個 Surface 一條 route 分區
> 對應設計：`docs/DESIGN.md` ｜ 架構：`docs/system-design.md` ｜ PRD：`docs/prd/01-05`

## 點跑

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # → dist/index.html（單檔，雙擊即開）
npm run smoke      # 機械驗收（build 產物 + demo 路線 8 步 + 跨 Surface 串連）
npm run shots      # 機械驗收 + 截圖到 docs/shots/
```

**拎得走嘅 demo**：`dist/index.html`（單檔，已入版控）——雙擊就用 `file://` 打開，唔需要 server、唔需要網絡。

## 三個 Surface（route 分區）

| Route | Surface | 內容 |
|---|---|---|
| `/m/chat` `/m/stats` `/m/settings` | `mobile-app` | 對話（語音輸入、STT 草稿、確認卡、任務卡片、**session 抽屜 ＋ 開新對話**）、每日任務數、設定 |
| `/d/chat` `/d/runtime` `/d/tools` `/d/stats` | `desktop-mac` | 對話（寬版）、Agent 狀態／Workspace／Session、audit log + Risk Gate 規則、統計 |
| `/t/console` | `cli-terminal` | sidecar console：streaming、relay 送達紀錄、風險閘攔截記錄 |

## Demo 路線（右下「Demo 路線」面板）

9 步、跨 3 個 Surface、共用同一個 mock store：

`step-1` 手機講嘢派任務 → `step-2` terminal 見到 sidecar 收到 → `step-3` 桌面 Agent 狀態 →
`step-4` 手機收任務卡片 + 語音通知 → `step-5` 手機出確認卡 → `step-6` terminal 見到工具執行 →
`step-7` 桌面 audit log → `step-8` 手機每日任務數 → `step-9` 手機對話 session 抽屜（自動分流 ＋ 開新對話）

面板另有：**五狀態切換器**（Happy / Loading / Empty / Error / Edge）、模擬 Agent 離線、重設資料。

## 目錄

```
src/
  main.tsx            HashRouter + mount
  App.tsx             route 分派
  index.css           design tokens 唯一來源（Tailwind v4 @theme）
  components/ui/      shadcn-style 組件（Radix primitives + cva）
  components/shell/   PhoneFrame / DesktopShell / TerminalShell
  features/           home · chat · stats · settings · runtime · tools · terminal
  mock/db.ts          seed 資料
  mock/store.ts       zustand store（單一真相源 + persist）
  demo/routes.ts      demo 路線定義
  demo/panel.tsx      demo 路線面板 + 五狀態切換器
scripts/smoke.mjs     機械驗收（puppeteer-core + 本機 Chrome）
```

## 邊界（設計期原型）

- ✅ 有：前端 code、mock store、demo 路線、五狀態
- ❌ 冇：真實後端、真實 API、真實業務邏輯、真實語音辨識／TTS —— 一律係 mock，唔可以當真功能睇
- production 實作由 `dav-developer` 另起；demo code 唔好直接當 production 用

## 驗收（`npm run smoke`）

build 綠 → 單檔無外部 CDN → `file://` mount 成功 → 三個 Surface route 有內容 →
demo 路線 8 步逐步跳到預期 route → 跨 Surface 資料流真串連（手機送出 → terminal 見到）→
Empty 狀態有零資料畫面 → 零 console error。
