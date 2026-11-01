# Voice Agent App — 手機 + macOS 語音 Agent

> 用講嘅方式派任務 → Agent 喺你部 Mac 上面做事 → 完成主動通知（語音）。
> 規劃 → 設計 → 原型 → 執行（批次 0 技術補證）已走完。

## 目錄

```
docs/
  backlog.md            19 個項目（US/Spike/TECH）＋ Module 對照 ＋ 批次 ＋ Open questions
  DESIGN.md             UX/UI ＋ design tokens ＋ 每 Surface shell ＋ 五狀態對照
  system-design.md      技術棧 ＋ Module/Surface 邊界 ＋ 資料流 ＋ 失敗降級 ＋ 安全邊界
  glossary_list.md      術語表（A-Z，跨階段統一用語）
  ac/<ID>.md / .html    每個項目嘅驗收條件（列印友好版）
  req/<ID>-requirement.md  需求錨點（用戶原話唯讀 ＋ R-ID ＋ 變更歷史）
  prd/01-05-*.md        5 份模組 PRD（FR ＋ 追溯矩陣）
  spike/                3 份 spike 實測報告
prototype/voice-agent/  系統 demo 原型（3 Surface ＋ 9 步 demo 路線 ＋ 五狀態切換器）
apps/tauri-mac/      M03 macOS App（Tauri 2）：Rust supervisor ＋ commands ＋ 對話介面
apps/tauri-mobile/   M01 手機 App（Tauri 2 iOS/Android）：WeChat 式對話 UI ＋ relay 客戶端 ＋ 跨機確認卡
runtime/
  sidecar/           M03 Mac sidecar（Pi SDK host）：session host ＋ IPC ＋ 崩潰重啟 ＋ 預算上限
  relay/             M02 relay client：冪等 ＋ transcript cursor ＋ SQS/DynamoDB 接線
  relay-api/         M02 HTTP API ＋ 成本守衛（部署：bash scripts/deploy-api.sh）
spikes/relay-transport/ SPIKE-001 實測程式（contract 測試 ＋ adapter ＋ 量度 CLI）
scripts/                check-all.sh（Gate 2 lint + Gate 3 回歸）＋ 文件探針
```

## 快速開始

```bash
# 睇 demo 原型（單檔，雙擊即開）
open prototype/voice-agent/dist/index.html
# 或者行互動版
cd prototype/voice-agent && npm i && npm run dev

# 本機閘點跑（lint + 回歸，11 步）
bash scripts/check-all.sh

# 手機 App（iOS simulator）
cd apps/tauri-mobile && npx tauri ios build -t aarch64-sim && npx tauri ios dev

# 端到端驗證（真 Pi SDK：Agent → 工具 → 確認卡 → 批核 → 執行）
cd runtime/sidecar && npm run build && node scripts/e2e-tool-flow.mjs

# 行 macOS App（會自動拉起 sidecar）
cd runtime/sidecar && npm run build          # 打包 sidecar → dist/main.mjs
cd ../../apps/tauri-mac && npx tauri dev     # 或 npx tauri build 出 .app

# SPIKE-001 量度（要 AWS 憑證）
cd spikes/relay-transport && npm i && npm test
```

## 環境要求（實作階段要留意）

| 嘢 | 狀態 |
|---|---|
| Node 22+ / npm | ✅ v26.10 |
| Rust（**必須 rustup toolchain**，唔係 Homebrew 個）| ⚠️ 已 `rustup default stable`；要用 `PATH="$HOME/.cargo/bin:$PATH"` |
| iOS Rust targets | ✅ 已裝 `aarch64-apple-ios` / `aarch64-apple-ios-sim` |
| Xcode + iOS SDK | ✅ 27.2（但**冇 simulator runtime** → `xcodebuild -downloadPlatform iOS`） |
| CocoaPods | ✅ `tauri ios init` 自動裝咗 1.17（連 Ruby 4.0.9） |
| AWS 帳戶 | ✅ account `631807311787` / ap-southeast-1 |
| Android SDK / 真機 | ❌ 未裝（OQ-11） |
| Apple Developer / Firebase 憑證 | ❌ 未提供（OQ-10） |

## 現況（2026-11-01）

- **規劃 ✅** 19 項目 / 100 SP / 5 個 Module / 6 批次
- **設計 ✅** 三層文件 + demo 原型（機械驗收 37 項全過）
- **執行 · 批次 0（3 個 Spike）** — SPIKE-001 ✅ 定案 **SQS long-poll**（p50 227ms / idle $0）；SPIKE-002 iOS ✅ / Android ⛔；SPIKE-003 Polly ✅ / APNs-FCM ⛔
- **執行 · 批次 5 = M05 tool-catalog** — ✅ 檔案工具（read/list/search/write ＋ 路徑鎖死）＋ terminal 工具（19 條危險命令黑名單 ＋ 60 秒超時 ＋ 輸出截斷）；**端到端實測通過**（真 Pi SDK → 工具 → 確認卡 → 批核 → 真寫入檔案）
- **執行 · 批次 1 = M03 mac-runtime** — ✅ 完成：Node sidecar（session host／自動分流／IPC／崩潰重啟／預算上限／真 Pi SDK）＋ **macOS Tauri 2 殼**（`apps/tauri-mac/`，.app 打包成功 ＋ 實機啟動拉起 sidecar 驗證）；未做：Workspace 選擇 UI、session 切換 UI、Relay(SQS) 接線
- **執行 · 批次 2 = M02 relay-backend** — ✅ 完成：relay client（冪等 ＋ transcript cursor ＋ SQS/DynamoDB）＋ HTTP API ＋ 認證 ＋ 成本守衛（AWS Budget \$5 + 用量 dashboard）＋ 單任務預算上限代碼（超時/token → abort → partial）
- **下一步**：批次 3 = M01 client-app（⚠️ 需要 iOS simulator runtime ＋ Android SDK ＋ 憑證：OQ-10/OQ-11）
