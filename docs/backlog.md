# Backlog — Voice Agent App（手機 + macOS）

> 產出：dav-planner Step 4（2026-11-01）｜來源：需求訪談（一次一題，V01；方案標推薦，V02）
> 狀態：全部 PENDING ｜ Module 已於設計階段切割（dav-designer Step 1，2026-11-01）

## Module 對照（設計階段切割）

| Module | 名稱 | SP | 承載 US |
| --- | --- | --- | --- |
| M01 | client-app（Tauri 2 跨端 App） | 37 | US-101, US-102, US-105, US-131, US-132, TECH-401, SPIKE-002, SPIKE-003 |
| M02 | relay-backend（AWS 中轉層） | 14 | US-104, US-141, SPIKE-001（+ US-105/131 server 側） |
| M03 | mac-runtime（Mac sidecar + Pi SDK） | 13 | US-103, TECH-402 |
| M04 | tool-governance（工具層 + Risk Gate + 確認） | 15 | US-111, US-113, US-106 |
| M05 | tool-catalog（外部服務 + 檔案 + terminal） | 21 | US-112, US-121, US-122 |

> Module 邊界 = 測試邊界；探針只針對本 Module 介面同內部狀態，唔跨 Module 檢查。

## ⚠️ 需求成熟度

| 維度 | 分數 | 理由 |
|------|------|------|
| 涵蓋率 | 3 | 核心 4 維度 + 5 條觸發咗嘅補充維度（Non-goals／Edge cases／Risks／Open questions／業務邏輯與依賴）全部涵蓋 |
| 清晰度 | 2 | 行為同流程已具體，但有 9 條 Open questions 未決（見下） |
| 可行性 | 1 | 已知 Pi SDK 能力與平台限制，但未做 Spike → **需求成熟度不足**，已用 3 個 P0 Spike 排在最前補證 |

> 規則：任一維度 = 1 分 → 可寫 Backlog 但要備註 ⚠「需求成熟度不足」。3 個 Spike 建議喺任何開發 US 之前完成。

---

## Backlog

| US ID | 類型 | Module | 標題 | AC | 優先級 | Story Point | 狀態 | 依賴 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| SPIKE-001 | Spike | M02 | AWS relay transport 選型（AppSync Events / SQS long-poll / API Gateway WebSocket） | 2 條 BDD + DoD ｜ [md](ac/SPIKE-001.md) ｜ [html](ac/SPIKE-001.html) | P0 | 3 | PENDING | — |
| SPIKE-002 | Spike | M01 | Mobile device-native STT 可行性（iOS Speech framework / Android SpeechRecognizer 粵語） | 2 條 BDD + DoD ｜ [md](ac/SPIKE-002.md) ｜ [html](ac/SPIKE-002.html) | P0 | 3 | PENDING | — |
| SPIKE-003 | Spike | M01-M02 | Mobile push（APNs/FCM）+ Polly 語音通知可行性 + iOS 發佈路徑 | 3 條 BDD + DoD ｜ [md](ac/SPIKE-003.md) ｜ [html](ac/SPIKE-003.html) | P0 | 3 | PENDING | — |
| M00-US-101 | US | M01 | App 對話介面（Tauri 2 跨 iOS/Android/macOS，WeChat 式） | 4 條 BDD + DoD ｜ [md](ac/M00-US-101.md) ｜ [html](ac/M00-US-101.html) | P0 | 5 | PENDING | — |
| M00-US-102 | US | M01 | 語音輸入（device native STT + 可編輯文字） | 5 條 BDD + DoD ｜ [md](ac/M00-US-102.md) ｜ [html](ac/M00-US-102.html) | P0 | 5 | PENDING | SPIKE-002, M00-US-101 |
| M00-US-103 | US | M03 | Mac sidecar：Pi SDK runtime host（Tauri sidecar = Node/Bun process） | 4 條 BDD + DoD ｜ [md](ac/M00-US-103.md) ｜ [html](ac/M00-US-103.html) | P0 | 8 | PENDING | — |
| M00-US-104 | US | M02 | AWS relay v1 + transcript 持久化（App ⇄ Mac 通道 + 冪等） | 5 條 BDD + DoD ｜ [md](ac/M00-US-104.md) ｜ [html](ac/M00-US-104.html) | P0 | 8 | PENDING | SPIKE-001, M00-US-101, M00-US-103 |
| M00-US-105 | US | M01-M02 | 語音回覆（TTS = AWS Polly → App 播放） | 4 條 BDD + DoD ｜ [md](ac/M00-US-105.md) ｜ [html](ac/M00-US-105.html) | P1 | 5 | PENDING | M00-US-104 |
| M00-US-106 | US | M04 | 內容產出任務（read-only 工具 + 交付物 = 每日任務數嘅第一個來源） | 4 條 BDD + DoD ｜ [md](ac/M00-US-106.md) ｜ [html](ac/M00-US-106.html) | P0 | 5 | PENDING | M00-US-103, M00-US-104, M00-US-111 |
| M00-US-111 | US | M02-M04 | 工具層 + 風險分級（Risk Gate）+ AuthProvider 可插拔認證 | 4 條 BDD + DoD ｜ [md](ac/M00-US-111.md) ｜ [html](ac/M00-US-111.html) | P0 | 5 | PENDING | M00-US-103 |
| M00-US-112 | US | M05 | 外部服務工具接入（首個 target 待定：GitHub / Gmail / Notion） | 4 條 BDD + DoD ｜ [md](ac/M00-US-112.md) ｜ [html](ac/M00-US-112.html) | P1 | 8 | PENDING | M00-US-111, M00-US-113 |
| M00-US-113 | US | M01-M04 | 高風險操作確認流程（App 預覽 + 語音 confirm + 5 分鐘過期） | 4 條 BDD + DoD ｜ [md](ac/M00-US-113.md) ｜ [html](ac/M00-US-113.html) | P0 | 5 | PENDING | M00-US-111, M00-US-102 |
| M00-US-121 | US | M05 | Workspace 檔案工具（read / write / search，路徑鎖死喺 workspace） | 4 條 BDD + DoD ｜ [md](ac/M00-US-121.md) ｜ [html](ac/M00-US-121.html) | P1 | 5 | PENDING | M00-US-111, M00-US-113, M00-US-103 |
| M00-US-122 | US | M05 | Terminal 工具 + 危險命令閘（黑名單 / 60 秒超時 / 輸出截斷） | 4 條 BDD + DoD ｜ [md](ac/M00-US-122.md) ｜ [html](ac/M00-US-122.html) | P1 | 8 | PENDING | M00-US-111, M00-US-113, M00-US-121 |
| M00-US-131 | US | M01-M02 | 完成推播（APNs/FCM）+ Polly 語音通知（鎖屏可聽） | 4 條 BDD + DoD ｜ [md](ac/M00-US-131.md) ｜ [html](ac/M00-US-131.html) | P0 | 5 | PENDING | SPIKE-003, M00-US-104, M00-US-105 |
| M00-US-132 | US | M01-M02 | 每日任務數統計 + 每日摘要（核心成功指標） | 3 條 BDD + DoD ｜ [md](ac/M00-US-132.md) ｜ [html](ac/M00-US-132.html) | P1 | 3 | PENDING | M00-US-106, M00-US-104 |
| M00-US-141 | US | M02 | 成本守衛（AWS 預算 alarm + 單任務預算上限 + 用量 dashboard） | 3 條 BDD + DoD ｜ [md](ac/M00-US-141.md) ｜ [html](ac/M00-US-141.html) | P1 | 3 | PENDING | M00-US-104 |
| TECH-401 | TECH | M01 | 自建 Tauri mobile native plugin 層（STT / local TTS / push 冇官方 plugin） | 1 條 BDD + DoD ｜ [md](ac/TECH-401.md) ｜ [html](ac/TECH-401.html) | P1 | 8 | PENDING | — |
| TECH-402 | TECH | M03 | Pi SDK session 持久化 / 版本相容（sidecar session files + transcript 對齊） | 2 條 BDD + DoD ｜ [md](ac/TECH-402.md) ｜ [html](ac/TECH-402.html) | P2 | 5 | PENDING | M00-US-103 |

**合計**: 19 個項目（14 US + 3 Spike + 2 TECH）＝ 100 SP

---

## v1 非目標（Non-goals）

1. 公開註冊 / 多租戶 / 付費（只留可插拔認證接口，見 US-111）
2. 即時多輪 steering（同一任務中途改方向）
3. 離線模式（v1 必須有網絡）
4. 手機 ⇄ macOS 即時同步同一份對話（只保證拉取時一致）
5. App Store 公開發佈（先用 TestFlight / 個人簽名自裝）

## 交付次序（風險序，同一 release 內完成）

| 階段 | 內容 | 項目 |
|------|------|------|
| 0 架構補證 | 三個 Spike，補技術可行性 | SPIKE-001, SPIKE-002, SPIKE-003 |
| ① 語音對話 loop | 對話 → 語音輸入 → Agent → 內容交付 → 語音回覆 | M00-US-101, M00-US-102, M00-US-103, M00-US-104, M00-US-105, M00-US-106 |
| ② 外部服務 | 工具層 + 風險閘 + 確認流程 + 第一個外部服務 | M00-US-111, M00-US-112, M00-US-113 |
| ③ 檔案 + terminal | 檔案工具 + terminal 工具（風險最高，最後做） | M00-US-121, M00-US-122 |
| ④ 通知 + 指標 | 完成推播 + 語音通知 + 每日任務數 + 成本守衛 | M00-US-131, M00-US-132, M00-US-141 |
| 技術債 | Tauri native plugin 層 + session 持久化 | TECH-401, TECH-402 |

### 批次清單（1 批次 = 1 個完整 Module）

| 批次 | Module | 涵蓋 US | SP | 先後 |
| --- | --- | --- | --- | --- |
| 0（前置補證） | — | SPIKE-001, SPIKE-002, SPIKE-003 | 9 | 可平行 |
| 1 | M03 mac-runtime | US-103, TECH-402 | 13 | 外部依賴最少，先證明 Pi SDK 落地 |
| 2 | M02 relay-backend | US-104, US-141 | 14 | 中轉 + 認證 + 持久化 |
| 3 | M01 client-app | US-101, US-102, US-105, US-131, US-132, TECH-401 | 37 | 依賴批次 1 + 2 |
| 4 | M04 tool-governance | US-111, US-113, US-106 | 15 | 依賴批次 1 + 3 |
| 5 | M05 tool-catalog | US-112, US-121, US-122 | 21 | 依賴批次 4 |

> 批次 = 交付 = 測試 = 回報邊界。冇 sprint 層、冇 velocity。

---

## Open questions（待確認）

| ID | 問題 | 影響項目 | 狀態 |
|----|------|----------|------|
| OQ-1 | 第一個外部服務工具 target（GitHub / Gmail / Notion / 其他）？ | M00-US-112 | **批次 5 前必答**（US-112 開工會阻塞） |
| OQ-2 | 單任務 token / 時間預算嘅具體數值？ | M00-US-141 | **批次 2 前要有初值**（成本守衛要喺 Relay 開工時有上限） |
| OQ-3 | 「任務完成」嘅定義（Agent 宣告 vs 用戶確認）？ | M00-US-132 | 影響每日任務數準確度 |
| OQ-4 | transcript 保留期 + 刪除 / 匯出機制？ | M00-US-104 | 資料私隱 + 成本 |
| OQ-5 | Mac 睡眠 / 熄屏時要唔要保持 sidecar 醒著（caffeinate / launchd）？ | M00-US-103 | **批次 1 前必答**（runtime 生命週期，直接影響「離開屋企仲能不能用」） |
| OQ-6 | iOS 語音通知音檔大小上限同降級策略？ | SPIKE-003 | 技術上限，Spike 會實測 |
| OQ-7 | iOS 發佈路徑（TestFlight vs App Store）同簽名安排？ | SPIKE-003 | 批次 3 前要定（影響點裝落手機試） |
| OQ-8 | Cognito 遷移嘅時機同邊界（多租戶資料模型）？ | M00-US-111 | v2 之前決定 |
| OQ-9 | workspace 位置：預設 `~/agent-workspace` 定支援多個 workspace？ | M00-US-103 / M00-US-121 | 影響檔案工具範圍 |

---

## 項目詳細

### SPIKE-001 詳細（AWS relay transport 選型（AppSync Events / SQS long-poll / API Gateway WebSocket））

- **對應 Module**: M02（Module 名稱見「Module 對照」表）
- **負責 dev**: （派工後填入）
- **預估時間**: 3 SP
- **AC**: 2 條 Given-When-Then + DoD → [md](ac/SPIKE-001.md) ｜ [html](ac/SPIKE-001.html)
- **業務規則**: 單用戶量級（≤ 10 訊息/分鐘、≤ 1 常駐連線）；唔引入常駐 Fargate（成本 > $30/月 直接否決）
- **依賴**: AWS account、Tauri 2 hello-world
- **驗收方式**: 文件 + 一次真實端到端 demo（錄屏）
- **為什麼這個優先**: P0：所有 US-104 之後嘅項目都靠 transport 揀型，揀錯要重寫 client 同 backend，補證成本遠低過返工。
- **需求錨點**: [req/SPIKE-001-requirement.md](req/SPIKE-001-requirement.md)

### SPIKE-002 詳細（Mobile device-native STT 可行性（iOS Speech framework / Android SpeechRecognizer 粵語））

- **對應 Module**: M01（Module 名稱見「Module 對照」表）
- **負責 dev**: （派工後填入）
- **預估時間**: 3 SP
- **AC**: 2 條 Given-When-Then + DoD → [md](ac/SPIKE-002.md) ｜ [html](ac/SPIKE-002.html)
- **業務規則**: 語言預設 zh-HK（粵語）；STT 結果一定要可編輯，唔可以自動送出
- **依賴**: iOS + Android 真機、Tauri 2 mobile 工具鏈
- **驗收方式**: 真機測試數據 + 可運行嘅 plugin 骨架
- **為什麼這個優先**: P0：語音係呢個產品嘅入口，平台粵語支援度直接決定 US-102 技術路線，亦可能推翻「device native 唔使上傳音頻」嘅私隱前提。
- **需求錨點**: [req/SPIKE-002-requirement.md](req/SPIKE-002-requirement.md)

### SPIKE-003 詳細（Mobile push（APNs/FCM）+ Polly 語音通知可行性 + iOS 發佈路徑）

- **對應 Module**: M01-M02（Module 名稱見「Module 對照」表）
- **負責 dev**: （派工後填入）
- **預估時間**: 3 SP
- **AC**: 3 條 Given-When-Then + DoD → [md](ac/SPIKE-003.md) ｜ [html](ac/SPIKE-003.html)
- **業務規則**: 推播 payload 只准包含任務摘要，唔准塞完整 transcript
- **依賴**: Apple Developer / Firebase 帳號、AWS Polly
- **驗收方式**: 真機收到 push + 鎖屏語音播放錄屏
- **為什麼這個優先**: P0：「雙手唔得閒」靠嘅就係完成時你唔使望住 App；iOS 附件大小限制係隱性風險，唔驗證會喺最後一刻爆。
- **需求錨點**: [req/SPIKE-003-requirement.md](req/SPIKE-003-requirement.md)

### M00-US-101 詳細（App 對話介面（Tauri 2 跨 iOS/Android/macOS，WeChat 式））

- **對應 Module**: M01（Module 名稱見「Module 對照」表）
- **負責 dev**: （派工後填入）
- **預估時間**: 5 SP
- **AC**: 4 條 Given-When-Then + DoD → [md](ac/M00-US-101.md) ｜ [html](ac/M00-US-101.html)
- **業務規則**: App 層只負責 view + 呼叫 API，唔准包含任何 Agent 邏輯；介面語言預設繁中
- **依賴**: Tauri 2、Rust core、AWS relay API（US-104）
- **驗收方式**: 跑 `REGRESSION_MODULE=M00 ./run_pipeline.sh M00-US-101`
- **為什麼這個優先**: P0：呢個係用戶唯一接觸面；冇佢，之後所有能力都驗收唔到。
- **需求錨點**: [req/M00-US-101-requirement.md](req/M00-US-101-requirement.md)

### M00-US-102 詳細（語音輸入（device native STT + 可編輯文字））

- **對應 Module**: M01（Module 名稱見「Module 對照」表）
- **負責 dev**: （派工後填入）
- **預估時間**: 5 SP
- **AC**: 5 條 Given-When-Then + DoD → [md](ac/M00-US-102.md) ｜ [html](ac/M00-US-102.html)
- **業務規則**: STT 一律 device native（音頻唔上傳）；語言 zh-HK；STT 文字必須經用戶確認（可編輯）先送出
- **依賴**: SPIKE-002 結論、Tauri mobile native plugin（TECH-401）
- **驗收方式**: 跑 `REGRESSION_MODULE=M00 ./run_pipeline.sh M00-US-102`
- **為什麼這個優先**: P0：「唔使打字」係呢個產品嘅核心價值；呢個係第一個真正解決痛點嘅功能。
- **需求錨點**: [req/M00-US-102-requirement.md](req/M00-US-102-requirement.md)

### M00-US-103 詳細（Mac sidecar：Pi SDK runtime host（Tauri sidecar = Node/Bun process））

- **對應 Module**: M03（Module 名稱見「Module 對照」表）
- **負責 dev**: （派工後填入）
- **預估時間**: 8 SP
- **AC**: 4 條 Given-When-Then + DoD → [md](ac/M00-US-103.md) ｜ [html](ac/M00-US-103.html)
- **業務規則**: session 由 sidecar 用 file-backed SessionManager 持久化喺 Mac 本地（唔上傳雲端）；workspace 由用戶指定（預設 `~/agent-workspace`）
- **依賴**: Pi SDK（Node ≥ 20 或 Bun）、Tauri sidecar 機制
- **驗收方式**: 跑 `REGRESSION_MODULE=M00 ./run_pipeline.sh M00-US-103`
- **為什麼這個優先**: P0：呢個係「真正執行」嘅落點 —— 冇佢，全部任務類 US 都做唔到。
- **需求錨點**: [req/M00-US-103-requirement.md](req/M00-US-103-requirement.md)

### M00-US-104 詳細（AWS relay v1 + transcript 持久化（App ⇄ Mac 通道 + 冪等））

- **對應 Module**: M02（Module 名稱見「Module 對照」表）
- **負責 dev**: （派工後填入）
- **預估時間**: 8 SP
- **AC**: 5 條 Given-When-Then + DoD → [md](ac/M00-US-104.md) ｜ [html](ac/M00-US-104.html)
- **業務規則**: transcript 存 DynamoDB（partition key = user_id）；每則訊息有 `request_id`（UUID）做冪等鍵；token 唔可以出現喺任何 log
- **依賴**: SPIKE-001 結論、AWS（Lambda / DynamoDB / relay transport）、M00-US-103
- **驗收方式**: 跑 `REGRESSION_MODULE=M00 ./run_pipeline.sh M00-US-104`
- **為什麼這個優先**: P0：呢個係手機 → Mac 嘅唯一通道，亦係「冇消息遺失」嘅保證。
- **需求錨點**: [req/M00-US-104-requirement.md](req/M00-US-104-requirement.md)

### M00-US-105 詳細（語音回覆（TTS = AWS Polly → App 播放））

- **對應 Module**: M01-M02（Module 名稱見「Module 對照」表）
- **負責 dev**: （派工後填入）
- **預估時間**: 5 SP
- **AC**: 4 條 Given-When-Then + DoD → [md](ac/M00-US-105.md) ｜ [html](ac/M00-US-105.html)
- **業務規則**: TTS 一律用 AWS Polly；音檔 cache 24 小時；回覆 > 800 字只播前段並提示「全文睇螢幕」
- **依賴**: AWS Polly、M00-US-131（push 通知）
- **驗收方式**: 跑 `REGRESSION_MODULE=M00 ./run_pipeline.sh M00-US-105`
- **為什麼這個優先**: P1：語音回覆明顯提升「唔使望住屏幕」嘅體驗，但唔阻塞核心任務流。
- **需求錨點**: [req/M00-US-105-requirement.md](req/M00-US-105-requirement.md)

### M00-US-106 詳細（內容產出任務（read-only 工具 + 交付物 = 每日任務數嘅第一個來源））

- **對應 Module**: M04（Module 名稱見「Module 對照」表）
- **負責 dev**: （派工後填入）
- **預估時間**: 5 SP
- **AC**: 4 條 Given-When-Then + DoD → [md](ac/M00-US-106.md) ｜ [html](ac/M00-US-106.html)
- **業務規則**: read-only 工具自動執行；單任務上限 15 分鐘，超時標記 partial 並通知
- **依賴**: M00-US-103、M00-US-104、M00-US-111（工具層風險分級）
- **驗收方式**: 跑 `REGRESSION_MODULE=M00 ./run_pipeline.sh M00-US-106`
- **為什麼這個優先**: P0：呢個係「每日完成任務數」指標嘅第一個真實數據來源 —— 冇佢，核心成功指標量唔到。
- **需求錨點**: [req/M00-US-106-requirement.md](req/M00-US-106-requirement.md)

### M00-US-111 詳細（工具層 + 風險分級（Risk Gate）+ AuthProvider 可插拔認證）

- **對應 Module**: M02-M04（Module 名稱見「Module 對照」表）
- **負責 dev**: （派工後填入）
- **預估時間**: 5 SP
- **AC**: 4 條 Given-When-Then + DoD → [md](ac/M00-US-111.md) ｜ [html](ac/M00-US-111.html)
- **業務規則**: 風險級別只有 3 檔；`write` / `external_effect` 必須先確認；每次工具調用都寫 audit log（tool / args 摘要 / 結果 / ts）；AuthProvider 唔准滲入 App 層
- **依賴**: M00-US-103
- **驗收方式**: 跑 `REGRESSION_MODULE=M00 ./run_pipeline.sh M00-US-111`
- **為什麼這個優先**: P0：風險閘係「Agent 做錯事造成真實損失」呢個最大威脅嘅唯一防線，亦係將來開放寫入能力嘅前提。
- **需求錨點**: [req/M00-US-111-requirement.md](req/M00-US-111-requirement.md)

### M00-US-112 詳細（外部服務工具接入（首個 target 待定：GitHub / Gmail / Notion））

- **對應 Module**: M05（Module 名稱見「Module 對照」表）
- **負責 dev**: （派工後填入）
- **預估時間**: 8 SP
- **AC**: 4 條 Given-When-Then + DoD → [md](ac/M00-US-112.md) ｜ [html](ac/M00-US-112.html)
- **業務規則**: 憑證只存 Mac 本地；外部工具一律要登記 risk_level；首個 target 未定（Open question）
- **依賴**: M00-US-111、M00-US-113、OQ-1 嘅決定
- **驗收方式**: 跑 `REGRESSION_MODULE=M00 ./run_pipeline.sh M00-US-112`
- **為什麼這個優先**: P1：係「三樣都要」入面嘅第二類能力；但要先由用戶揀第一個外部服務先做得落手。
- **需求錨點**: [req/M00-US-112-requirement.md](req/M00-US-112-requirement.md)

### M00-US-113 詳細（高風險操作確認流程（App 預覽 + 語音 confirm + 5 分鐘過期））

- **對應 Module**: M01-M04（Module 名稱見「Module 對照」表）
- **負責 dev**: （派工後填入）
- **預估時間**: 5 SP
- **AC**: 4 條 Given-When-Then + DoD → [md](ac/M00-US-113.md) ｜ [html](ac/M00-US-113.html)
- **業務規則**: 確認卡 5 分鐘有效；同一時間只准一張卡；「取消」係最終拒絕（唔自動重試）
- **依賴**: M00-US-111、M00-US-102
- **驗收方式**: 跑 `REGRESSION_MODULE=M00 ./run_pipeline.sh M00-US-113`
- **為什麼這個優先**: P0：冇確認機制就唔敢開任何 write 類工具，第二、三階段能力全部封死喺度。
- **需求錨點**: [req/M00-US-113-requirement.md](req/M00-US-113-requirement.md)

### M00-US-121 詳細（Workspace 檔案工具（read / write / search，路徑鎖死喺 workspace））

- **對應 Module**: M05（Module 名稱見「Module 對照」表）
- **負責 dev**: （派工後填入）
- **預估時間**: 5 SP
- **AC**: 4 條 Given-When-Then + DoD → [md](ac/M00-US-121.md) ｜ [html](ac/M00-US-121.html)
- **業務規則**: 所有路徑限制喺 workspace 根目錄內；寫入必須確認；大檔（> 1MB）截斷回傳
- **依賴**: M00-US-111、M00-US-113、M00-US-103
- **驗收方式**: 跑 `REGRESSION_MODULE=M00 ./run_pipeline.sh M00-US-121`
- **為什麼這個優先**: P1：「三樣都要」入面嘅第三類能力；風險較 terminal 低，所以排喺 terminal 之前做。
- **需求錨點**: [req/M00-US-121-requirement.md](req/M00-US-121-requirement.md)

### M00-US-122 詳細（Terminal 工具 + 危險命令閘（黑名單 / 60 秒超時 / 輸出截斷））

- **對應 Module**: M05（Module 名稱見「Module 對照」表）
- **負責 dev**: （派工後填入）
- **預估時間**: 8 SP
- **AC**: 4 條 Given-When-Then + DoD → [md](ac/M00-US-122.md) ｜ [html](ac/M00-US-122.html)
- **業務規則**: 危險命令黑名單（rm -rf / sudo / curl|sh / mkfs / dd / shutdown 等）；超時 60 秒；輸出截斷 200 行；所有命令寫 audit log
- **依賴**: M00-US-111、M00-US-113、M00-US-121
- **驗收方式**: 跑 `REGRESSION_MODULE=M00 ./run_pipeline.sh M00-US-122`
- **為什麼這個優先**: P1：terminal 係風險最高嘅工具，必須排喺風險閘（US-111/113）之後，唔可以先做。
- **需求錨點**: [req/M00-US-122-requirement.md](req/M00-US-122-requirement.md)

### M00-US-131 詳細（完成推播（APNs/FCM）+ Polly 語音通知（鎖屏可聽））

- **對應 Module**: M01-M02（Module 名稱見「Module 對照」表）
- **負責 dev**: （派工後填入）
- **預估時間**: 5 SP
- **AC**: 4 條 Given-When-Then + DoD → [md](ac/M00-US-131.md) ｜ [html](ac/M00-US-131.html)
- **業務規則**: 推播 payload 只准包含任務摘要（唔准塞完整 transcript）；mp3 存 S3 + URL 拉取；憑證唔落 repo
- **依賴**: SPIKE-003、AWS（S3 / Lambda）、APNs / FCM
- **驗收方式**: 跑 `REGRESSION_MODULE=M00 ./run_pipeline.sh M00-US-131`
- **為什麼這個優先**: P0：「雙手唔得閒」靠嘅就係完成通知 —— 你唔會一直望住 App，冇 push 成個體驗就斷。
- **需求錨點**: [req/M00-US-131-requirement.md](req/M00-US-131-requirement.md)

### M00-US-132 詳細（每日任務數統計 + 每日摘要（核心成功指標））

- **對應 Module**: M01-M02（Module 名稱見「Module 對照」表）
- **負責 dev**: （派工後填入）
- **預估時間**: 3 SP
- **AC**: 3 條 Given-When-Then + DoD → [md](ac/M00-US-132.md) ｜ [html](ac/M00-US-132.html)
- **業務規則**: 「任務完成」= Agent 宣告成功且用戶冇反對（partial 唔計）；打字速度假設 40 字/分鐘（可配置）
- **依賴**: M00-US-106、M00-US-104
- **驗收方式**: 跑 `REGRESSION_MODULE=M00 ./run_pipeline.sh M00-US-132`
- **為什麼這個優先**: P1：呢個係你揀嘅核心成功指標 —— 冇統計就無法知道呢個產品有冇用。
- **需求錨點**: [req/M00-US-132-requirement.md](req/M00-US-132-requirement.md)

### M00-US-141 詳細（成本守衛（AWS 預算 alarm + 單任務預算上限 + 用量 dashboard））

- **對應 Module**: M02（Module 名稱見「Module 對照」表）
- **負責 dev**: （派工後填入）
- **預估時間**: 3 SP
- **AC**: 3 條 Given-When-Then + DoD → [md](ac/M00-US-141.md) ｜ [html](ac/M00-US-141.html)
- **業務規則**: v1 唔使用常駐 Fargate（成本門檻 < $30/月）；單任務上限 15 分鐘 + token 預算（具體數值待 Spike 實測後定，見 OQ-2）
- **依賴**: M00-US-104
- **驗收方式**: 跑 `REGRESSION_MODULE=M00 ./run_pipeline.sh M00-US-141`
- **為什麼這個優先**: P1：「成本失控」係最大威脅之一，而且好平好快做，唔做就等於放任第一個 AWS 帳單爆。
- **需求錨點**: [req/M00-US-141-requirement.md](req/M00-US-141-requirement.md)

### TECH-401 詳細（自建 Tauri mobile native plugin 層（STT / local TTS / push 冇官方 plugin））

- **對應 Module**: M01（Module 名稱見「Module 對照」表）
- **負責 dev**: （派工後填入）
- **預估時間**: 8 SP
- **AC**: 1 條 Given-When-Then + DoD → [md](ac/TECH-401.md) ｜ [html](ac/TECH-401.html)
- **業務規則**: 平台細節（Swift / Kotlin）唔准漏到 UI 層；憑證管理喺 plugin 層統一處理
- **依賴**: SPIKE-002、SPIKE-003
- **驗收方式**: 跑 `REGRESSION_MODULE=M00 ./run_pipeline.sh TECH-401`
- **為什麼這個優先**: P1：呢個係 US-102 / US-131 嘅前置技術債 —— 唔起好呢層，語音同通知兩樣都做唔到。
- **需求錨點**: [req/TECH-401-requirement.md](req/TECH-401-requirement.md)

### TECH-402 詳細（Pi SDK session 持久化 / 版本相容（sidecar session files + transcript 對齊））

- **對應 Module**: M03（Module 名稱見「Module 對照」表）
- **負責 dev**: （派工後填入）
- **預估時間**: 5 SP
- **AC**: 2 條 Given-When-Then + DoD → [md](ac/TECH-402.md) ｜ [html](ac/TECH-402.html)
- **業務規則**: session 存 Mac 本地；跨端只看 transcript；Pi SDK 版本升級必須過回歸先可以升
- **依賴**: M00-US-103
- **驗收方式**: 跑 `REGRESSION_MODULE=M00 ./run_pipeline.sh TECH-402`
- **為什麼這個優先**: P2：session 係長對話體驗嘅地基；版本相容唔理會喺 SDK 升級嗰日先爆，就會連帶用戶資料讀唔到。
- **需求錨點**: [req/TECH-402-requirement.md](req/TECH-402-requirement.md)

---

## 相關文件

- 術語表: `docs/glossary_list.md`
- 專案根目錄: `docs/backlog.md`（本檔）

> 模組切割（Module）同批次清單由 `dav-designer` 設計階段回填；planner 唔預設。
