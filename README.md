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
runtime/
  sidecar/           M03 Mac sidecar（Pi SDK host）：session host ＋ IPC ＋ 崩潰重啟
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

# 本機閘點跑（lint + 回歸）
bash scripts/check-all.sh

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
- **執行 · 批次 1 = M03 mac-runtime** — Node sidecar ✅（session host ＋ IPC ＋ 崩潰重啟 ＋ 真 Pi SDK 接線）；未做：Tauri macOS 殼、Workspace UI、Relay 接線
- **執行 · 批次 2 = M02 relay-backend** — relay client ✅（冪等 ＋ transcript cursor ＋ queue ack）＋ **真實 AWS 端到端通過**（dev stack `voice-agent-m02-relay`）；HTTP API + 認證 + 成本守衛 ✅（dev stack `voice-agent-m02-api`：POST /tasks → 202、GET /transcript → 200、錯 token → 401；AWS Budget \$5 + SNS + 用量 dashboard）
- **下一步**：批次 2 剩餘（單任務預算上限代碼）→ 批次 3 = M01 client-app（⚠️ 需要 iOS simulator runtime ＋ Android SDK ＋ 憑證：OQ-10/OQ-11）
