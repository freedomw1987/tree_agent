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
| SPIKE-001 | Spike | M02 | AWS relay transport 選型（AppSync Events / SQS long-poll / API Gateway WebSocket） | 2 條 BDD + DoD ｜ [md](ac/SPIKE-001.md) ｜ [html](ac/SPIKE-001.html) | P0 | 3 | 等待校驗 | — |
| SPIKE-002 | Spike | M01 | Mobile device-native STT 可行性（iOS Speech framework / Android SpeechRecognizer 粵語） | 2 條 BDD + DoD ｜ [md](ac/SPIKE-002.md) ｜ [html](ac/SPIKE-002.html) | P0 | 3 | 進行中（等真機/SDK） | — |
| SPIKE-003 | Spike | M01-M02 | Mobile push（APNs/FCM）+ Polly 語音通知可行性 + iOS 發佈路徑 | 3 條 BDD + DoD ｜ [md](ac/SPIKE-003.md) ｜ [html](ac/SPIKE-003.html) | P0 | 3 | 進行中（等憑證） | — |
| M00-US-101 | US | M01 | App 對話介面（Tauri 2 跨 iOS/Android/macOS，WeChat 式） | 9 條 BDD + DoD ｜ [md](ac/M00-US-101.md) ｜ [html](ac/M00-US-101.html) | P0 | 5 | 等待校驗 | — |
| M00-US-102 | US | M01 | 語音輸入（device native STT + 可編輯文字） | 8 條 BDD + DoD ｜ [md](ac/M00-US-102.md) ｜ [html](ac/M00-US-102.html) | P0 | 5 | 等待校驗 | SPIKE-002, M00-US-101 |
| M00-US-103 | US | M03 | Mac sidecar：Pi SDK runtime host（Tauri sidecar = Node/Bun process） | 7 條 BDD + DoD ｜ [md](ac/M00-US-103.md) ｜ [html](ac/M00-US-103.html) | P0 | 8 | 等待校驗 | — |
| M00-US-104 | US | M02 | AWS relay v1 + transcript 持久化（App ⇄ Mac 通道 + 冪等） | 5 條 BDD + DoD ｜ [md](ac/M00-US-104.md) ｜ [html](ac/M00-US-104.html) | P0 | 8 | 等待校驗 | SPIKE-001, M00-US-101, M00-US-103 |
| M00-US-105 | US | M01-M02 | 語音回覆（TTS = AWS Polly → App 播放） | 4 條 BDD + DoD ｜ [md](ac/M00-US-105.md) ｜ [html](ac/M00-US-105.html) | P1 | 5 | PENDING | M00-US-104 |
| M00-US-106 | US | M04 | 內容產出任務（read-only 工具 + 交付物 = 每日任務數嘅第一個來源） | 4 條 BDD + DoD ｜ [md](ac/M00-US-106.md) ｜ [html](ac/M00-US-106.html) | P0 | 5 | PENDING | M00-US-103, M00-US-104, M00-US-111 |
| M00-US-111 | US | M02-M04 | 工具層 + 風險分級（Risk Gate）+ AuthProvider 可插拔認證 | 4 條 BDD + DoD ｜ [md](ac/M00-US-111.md) ｜ [html](ac/M00-US-111.html) | P0 | 5 | 等待校驗 | M00-US-103 |
| M00-US-112 | US | M05 | 外部服務工具接入（首個 target 待定：GitHub / Gmail / Notion） | 4 條 BDD + DoD ｜ [md](ac/M00-US-112.md) ｜ [html](ac/M00-US-112.html) | P1 | 8 | PENDING | M00-US-111, M00-US-113 |
| M00-US-113 | US | M01-M04 | 高風險操作確認流程（App 預覽 + 語音 confirm + 5 分鐘過期） | 4 條 BDD + DoD ｜ [md](ac/M00-US-113.md) ｜ [html](ac/M00-US-113.html) | P0 | 5 | 等待校驗 | M00-US-111, M00-US-102 |
| M00-US-121 | US | M05 | Workspace 檔案工具（read / write / search，路徑鎖死喺 workspace） | 4 條 BDD + DoD ｜ [md](ac/M00-US-121.md) ｜ [html](ac/M00-US-121.html) | P1 | 5 | 等待校驗 | M00-US-111, M00-US-113, M00-US-103 |
| M00-US-122 | US | M05 | Terminal 工具 + 危險命令閘（黑名單 / 60 秒超時 / 輸出截斷） | 4 條 BDD + DoD ｜ [md](ac/M00-US-122.md) ｜ [html](ac/M00-US-122.html) | P1 | 8 | 等待校驗 | M00-US-111, M00-US-113, M00-US-121 |
| M00-US-131 | US | M01-M02 | 完成推播（APNs/FCM）+ Polly 語音通知（鎖屏可聽） | 4 條 BDD + DoD ｜ [md](ac/M00-US-131.md) ｜ [html](ac/M00-US-131.html) | P0 | 5 | PENDING | SPIKE-003, M00-US-104, M00-US-105 |
| M00-US-132 | US | M01-M02 | 每日任務數統計 + 每日摘要（核心成功指標） | 3 條 BDD + DoD ｜ [md](ac/M00-US-132.md) ｜ [html](ac/M00-US-132.html) | P1 | 3 | PENDING | M00-US-106, M00-US-104 |
| M00-US-141 | US | M02 | 成本守衛（AWS 預算 alarm + 單任務預算上限 + 用量 dashboard） | 3 條 BDD + DoD ｜ [md](ac/M00-US-141.md) ｜ [html](ac/M00-US-141.html) | P1 | 3 | 等待校驗 | M00-US-104 |
| TECH-401 | TECH | M01 | 自建 Tauri mobile native plugin 層（STT / local TTS / push 冇官方 plugin） | 1 條 BDD + DoD ｜ [md](ac/TECH-401.md) ｜ [html](ac/TECH-401.html) | P1 | 8 | 等待校驗 | — |
| TECH-402 | TECH | M03 | Pi SDK session 持久化 / 版本相容（sidecar session files + transcript 對齊） | 2 條 BDD + DoD ｜ [md](ac/TECH-402.md) ｜ [html](ac/TECH-402.html) | P2 | 5 | 等待校驗 | M00-US-103 |

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
| OQ-5 | Mac 睡眠 / 熄屏時要唔要保持 sidecar 醒著（caffeinate / launchd）？ | M00-US-103 | ✅ 已答：**跟 App 生死**（App 開住 = 醒住；閂咗/Mac 瞓咗 = 停 → 任務留隊列 ≥ 1 小時，返嚟補做） |
| OQ-6 | iOS 語音通知音檔大小上限同降級策略？ | SPIKE-003 | 技術上限，Spike 會實測 |
| OQ-7 | iOS 發佈路徑（TestFlight vs App Store）同簽名安排？ | SPIKE-003 | 批次 3 前要定（影響點裝落手機試；需 Apple Developer 帳戶） |
| OQ-10 | APNs auth key（.p8）＋ Firebase 專案（google-services.json / service account）可唔可以提供？ | M00-US-131 | **批次 3 前必答**（冇憑證就做唔到 iOS/Android 推播實測） |
| OQ-11 | iOS simulator runtime（xcodebuild -downloadPlatform iOS）＋ Android SDK/真機，可唔可以裝？ | SPIKE-002 / TECH-401 | **批次 3 前必答**（冇呢啲就驗證唔到語音輸入同 mobile build） |
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
- **實測結論**: 推薦方案 A（SQS long-poll）：實測 p50 227ms / p95 515ms（WS 嘅 993ms ÷ 4.4）、idle $0、每月 ≈ $0.03、只需 2 個 infra 資源、0 個 Lambda、0 個 setup 陷阱；AppSync Events 喺 ap-southeast-1 + 舊 CLI 建唔到（CFN schema 冇 EventConfig）→ blocked。詳見 docs/spike/relay-transport.md
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
- **實測結論**: iOS 部分實測完成：粵語 STT 可用（SFSpeechRecognizer locale `zh-HK` → available；`yue-Hant-HK` 唔支援）；Tauri 2 iOS 工具鏈行得通（tauri ios init 生成 Xcode project ＋ cargo build --target aarch64-apple-ios-sim 1m39s 成功）。未裝 iOS simulator runtime（要 xcodebuild -downloadPlatform iOS）、真機要簽名、Android 完全 blocked（本機無 SDK 無真機）→ 粵語 WER/準確率未驗證。詳見 docs/spike/mobile-stt.md
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
- **實測結論**: Polly 部分完成實測：粵語 voice `Hiujin` 存在（必須 --engine neural）；延遲 ~1.0s 基線 + ~12ms/字（168 字 = 2.1s / 212KB mp3、109KB opus）；mp3 唔可以內嵌 push payload（4KB 上限）→ 一律經 S3 URL；iOS 通知附件 ≤ 30 秒 → 通知只播 ≤ 30 字短摘要。APNs/FCM 未能實測（需用戶提供 Apple Developer 帳戶 + Firebase 專案）。詳見 docs/spike/push-and-tts.md
- **為什麼這個優先**: P0：「雙手唔得閒」靠嘅就係完成時你唔使望住 App；iOS 附件大小限制係隱性風險，唔驗證會喺最後一刻爆。
- **需求錨點**: [req/SPIKE-003-requirement.md](req/SPIKE-003-requirement.md)

### M00-US-101 詳細（App 對話介面（Tauri 2 跨 iOS/Android/macOS，WeChat 式））

- **對應 Module**: M01（Module 名稱見「Module 對照」表）
- **負責 dev**: （派工後填入）
- **預估時間**: 5 SP
- **AC**: 9 條 Given-When-Then + DoD → [md](ac/M00-US-101.md) ｜ [html](ac/M00-US-101.html)
- **業務規則**: App 層只負責 view + 呼叫 API，唔准包含任何 Agent 邏輯；介面語言預設繁中；對話 session 由 Agent 自動分流，App 只提供入口（session 抽屜 ＋ 開新對話）；黏底規則：在底部 → 新訊息到達自動滾到底；唔喺底部 → 唔搶位置，出「新訊息」按鈕，撳咗先滾落去（距底 ≤ 80px 當作「喺底部」）；macOS 版輸入列浮動喺視窗最下方（背景半透明 + blur，內容可喺底下滾動）
- **依賴**: Tauri 2、Rust core、AWS relay API（US-104）、M00-US-103（session 策略）
- **驗收方式**: 跑 `REGRESSION_MODULE=M00 ./run_pipeline.sh M00-US-101`
- **實測結論**: 手機版已起好並喺 iOS 27.2 simulator 實測（apps/tauri-mobile/）：WeChat 式對話介面（訊息氣泡、sticky scroll ＋「新訊息」掣、底部浮動輸入列、雙模式輸入（按住說話／鍵盤）、session 抽屜、確認卡卡）＋ Tauri 2 iOS/Android 專案 ＋ 圖標（digital-art 樹）。**跨機鏈路實測通過**：iOS App → relay-api（HTTP）→ SQS → Mac sidecar → Pi SDK Agent → 工具風險閘 → 確認卡經 relay 返手機 → 批核／取消 → 最終答案返到手機 UI。**未做**：真機（要簽名）、Android（要 Android SDK）、語音輸入 plugin、推播
- **為什麼這個優先**: P0：呢個係用戶唯一接觸面；冇佢，之後所有能力都驗收唔到。
- **需求錨點**: [req/M00-US-101-requirement.md](req/M00-US-101-requirement.md)

### M00-US-102 詳細（語音輸入（device native STT + 可編輯文字））

- **對應 Module**: M01（Module 名稱見「Module 對照」表）
- **負責 dev**: （派工後填入）
- **預估時間**: 5 SP
- **AC**: 8 條 Given-When-Then + DoD → [md](ac/M00-US-102.md) ｜ [html](ac/M00-US-102.html)
- **業務規則**: STT 一律 device native（音頻唔上傳）；語言 zh-HK；輸入模式：左側 Voice/鍵盤轉換鈕，Voice 模式按住「按住 說話」（放開即完成錄音並傳送），鍵盤模式多行輸入 ＋ 右側「傳送」鈕；『語音送出前先編輯』設定預設關（開啟則轉成文字先編輯再送出）；STT 空結果唔可以送出
- **依賴**: SPIKE-002 結論、Tauri mobile native plugin（TECH-401）
- **驗收方式**: 跑 `REGRESSION_MODULE=M00 ./run_pipeline.sh M00-US-102`
- **實測結論**: iOS STT plugin 已完成（plugins/tauri-plugin-ios-stt/）：Swift `SFSpeechRecognizer`（預設 zh-HK 粵語）＋ `AVAudioEngine` 收音 ＋ Rust 端 `run_mobile_plugin` 代理 ＋ app 層 `stt_start` / `stt_stop` / `stt_status` command ＋ Info.plist 權限說明。**simulator 實測**：權限 authorized ✅、zh-HK recognizer available ✅、on-device 支援 ✅、錄音引擎啟動 ✅、錯誤處理清晰 ✅；但 **Apple 個 speech recognizer 喺 simulator 初始化唔到**（已知限制，錯誤訊息已講明要真機）→ 真正嘅辨識文字要真機驗證。前端：啟動時查 stt_status，唔得就自動切鍵盤；按住說話失敗都會講明原因。**未做**：Android STT（Kotlin）、真機驗證
- **為什麼這個優先**: P0：「唔使打字」係呢個產品嘅核心價值；呢個係第一個真正解決痛點嘅功能。
- **需求錨點**: [req/M00-US-102-requirement.md](req/M00-US-102-requirement.md)

### M00-US-103 詳細（Mac sidecar：Pi SDK runtime host（Tauri sidecar = Node/Bun process））

- **對應 Module**: M03（Module 名稱見「Module 對照」表）
- **負責 dev**: （派工後填入）
- **預估時間**: 8 SP
- **AC**: 7 條 Given-When-Then + DoD → [md](ac/M00-US-103.md) ｜ [html](ac/M00-US-103.html)
- **業務規則**: session 由 sidecar 用 file-backed SessionManager 持久化喺 Mac 本地（唔上傳雲端）；workspace 由用戶指定（預設 `~/agent-workspace`）；session 屬於一個 workspace（切 workspace = 換一組 session）；session 分流規則：同一話題續舊、新話題開新並自動命名；fork（帶上文開新）只係第二入口、預設唔開；**sidecar 生命週期 = 跟 macOS App 生死**（App 開住 = 醒住；App 閂咗 / Mac 瞓咗 = 停 → 任務留喺 SQS 隊列保留 ≥ 1 小時，下次啟動自動補做）
- **依賴**: Pi SDK（Node ≥ 20 或 Bun）、Tauri sidecar 機制（`newSession` / `switchSession` / `fork`）
- **驗收方式**: 跑 `REGRESSION_MODULE=M00 ./run_pipeline.sh M00-US-103`
- **實測結論**: 批次 1 完成 ＋ macOS 殼接通：Node sidecar（session host／對話自動分流＋自動命名／stdio JSON lines IPC／崩潰自動重啟 ≤5 秒／單任務預算上限／真 Pi SDK 接線）＋ apps/tauri-mac（Tauri 2 殼：Rust supervisor ＋ agent_status/agent_prompt/agent_shutdown commands ＋ 前端對話介面 ＋ 浮動輸入列）＋ .app 打包成功（4.14 MiB）＋ 實機啟動驗證（app 啟動 → 自動拉起 sidecar → 開 Pi SDK session 目錄）。Rust 8 條探針 ＋ TS 24 條。**未做**：Workspace 選擇 UI、session 切換 UI、Relay(SQS) 接線（M02 client 已有，M03 未接）、真 Pi SDK 派任務實測（未接 SQS，所以仲未行過完整 prompt 流）。批次 1 已完成（Node/TS 層）：runtime/sidecar/ — session host（create/continue/open/list/fork/switch ＋ 自動分流 ＋ 自動命名 ＋ streaming chunk/done）、IPC 協議（stdio JSON lines，15 條探針）、崩潰 supervisor（自動重啟 ≤ 5 秒，實測 3 條探針）、真 Pi SDK factory（已實測開到 session：sessionFile → ~/.pi/agent/sessions/…jsonl，model MiniMax-M3.1-Flash，開 session 唔調模型）。**未做**：Tauri macOS 殼（App 顯示「Agent 已就緒」）、Workspace 選擇 UI、Relay(SQS) client 接線 → 對應 M01/M02 批次
- **為什麼這個優先**: P0：呢個係「真正執行」嘅落點 —— 冇佢，全部任務類 US 都做唔到。
- **需求錨點**: [req/M00-US-103-requirement.md](req/M00-US-103-requirement.md)

### M00-US-104 詳細（AWS relay v1 + transcript 持久化（App ⇄ Mac 通道 + 冪等））

- **對應 Module**: M02（Module 名稱見「Module 對照」表）
- **負責 dev**: （派工後填入）
- **預估時間**: 8 SP
- **AC**: 5 條 Given-When-Then + DoD → [md](ac/M00-US-104.md) ｜ [html](ac/M00-US-104.html)
- **業務規則**: transcript 存 DynamoDB（partition key = user_id；sort key = ts#request_id#role —— **必須包埋 role**，否則同一毫秒內 user/agent 兩條會撞 key、增量拉取會漏條）；每則訊息有 `request_id`（UUID）做冪等鍵；token 唔可以出現喺任何 log
- **依賴**: SPIKE-001 結論、AWS（Lambda / DynamoDB / relay transport）、M00-US-103
- **驗收方式**: 跑 `REGRESSION_MODULE=M00 ./run_pipeline.sh M00-US-104`
- **實測結論**: HTTP API 已落地並真實驗證（runtime/relay-api/）：POST /tasks → 202 + requestId（冪等）／GET /transcript → 200 + cursor 增量；認證喺 API Lambda 內用同一個 authorize() 純函式驗 token（無/錯 token → 401、有效 → 202）。**點解唔用 API Gateway REQUEST authorizer**：實測嗰條路徑喺 authorizer 之後、integration 之前回 500，而且 API Lambda 一次都唔會被 invoke（authorizer 有被 invoke、response 正確）→ 改為 Lambda 內驗證，100% 正常。已部署 dev stack `voice-agent-m02-api`（HTTP API + Lambda + IAM），部署腳本 scripts/deploy-api.sh（可重現）。
- **為什麼這個優先**: P0：呢個係手機 → Mac 嘅唯一通道，亦係「冇消息遺失」嘅保證。
- **需求錨點**: [req/M00-US-104-requirement.md](req/M00-US-104-requirement.md)

### M00-US-105 詳細（語音回覆（TTS = AWS Polly → App 播放））

- **對應 Module**: M01-M02（Module 名稱見「Module 對照」表）
- **負責 dev**: （派工後填入）
- **預估時間**: 5 SP
- **AC**: 4 條 Given-When-Then + DoD → [md](ac/M00-US-105.md) ｜ [html](ac/M00-US-105.html)
- **業務規則**: TTS 一律用 AWS Polly voice `Hiujin`（yue-CN，**engine 必須 neural**）；格式 mp3（通知附件唔用 opus，iOS 支援唔穩）；App 內播報只讀前 150 字；通知版 ≤ 30 字摘要；mp3 存 S3 ＋ URL 交付；cache 24 小時；長回覆（> 800 字）只播前段並提示「全文睇螢幕」
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
- **實測結論**: M04 工具治理核心已完成（runtime/sidecar/src/tools/）：工具註冊表（**冇 riskLevel 唔准註冊**、重複名拒絕）＋ 統一執行入口（read_only 自動跑；write / external_effect 產生確認卡先跑）＋ 確認生命週期（approved / cancelled / expired，5 分鐘 TTL）＋ audit log（工具／風險級別／參數摘要／結果／時間；參數只記 key 摘要，唔記全文避免敏感內容入 log）＋ 語音 confirm 解析。IPC 已接上（confirm_request 出／confirm_response 回、list_tools、audit_log）。探針 10（TS）。**未做**：Pi SDK 內建工具（read/bash/edit/write）仲未經風險閘（M05 第一個真工具會經 pi.registerTool 掛入去）
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
- **實測結論**: 確認流程代碼完成：sidecar 出 confirm_request（工具名／風險級別／預覽／過期時間）→ Rust 轉 Tauri event → macOS 前端出確認卡（預覽 + 確認/取消 + 5 分鐘倒數提示）→ agent_confirm command 回 sidecar。**語音 confirm**：確認卡喺度時輸入「confirm / 確認 / ok / 好 / yes / 批准」即批；「cancel / 取消 / no」即拒；只作用於當前未過期嘅卡。探針 10（TS 生命週期）+ 1（Rust 解析 confirm_request）。**未做**：iOS/Android 版確認卡 UI（批次 3）；真實工具觸發嘅端到端畫面（M05 之後）
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
- **實測結論**: 已完成並端到端驗證：fs_read / fs_list / fs_search（read_only，自動執行）／ fs_write（write，先出確認卡顯示 diff 預覽）。路徑全部經 resolveInWorkspace() 守衛，`../../etc/passwd` 呢類越界會被拒（探針驗證）。fs_write 預覽用 LCS 行級 diff（新檔／改檔都出 unified 格式）。**端到端實測**（scripts/e2e-tool-flow.mjs，真 Pi SDK）：Agent 調用 fs_write → 確認卡經 IPC 出 → 批核 → 檔案真係寫入 → audit 記 ok；再派 fs_read → 自動執行、冇確認卡 → audit 記 ok。探針 13 條（M05-tool-*）
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
- **實測結論**: 已完成：terminal 工具（external_effect → 一定先問用戶）。危險命令閘有兩層 —— ①**預檢黑名單**（19 條 regex：rm -rf /、sudo、shutdown、mkfs、dd of=/dev/、curl|sh、fork bomb、find -delete、git push --force…）命中就**唔會出確認卡**，直接拒絕；②確認卡顯示完整命令。另有 60 秒超時（可調，上限 120 秒，超時 kill）＋ 輸出截斷（4000 字：頭 75% ＋ 尾 20% ＋ 省略字數）。**探試捉到真漏洞**：原本 regex 漏咗 `rm -rf /`（已修），並加咗反向探針確保 `rm -rf ./build` 唔會被過度攔截。探針 13 條（M05-tool-*）
- **為什麼這個優先**: P1：terminal 係風險最高嘅工具，必須排喺風險閘（US-111/113）之後，唔可以先做。
- **需求錨點**: [req/M00-US-122-requirement.md](req/M00-US-122-requirement.md)

### M00-US-131 詳細（完成推播（APNs/FCM）+ Polly 語音通知（鎖屏可聽））

- **對應 Module**: M01-M02（Module 名稱見「Module 對照」表）
- **負責 dev**: （派工後填入）
- **預估時間**: 5 SP
- **AC**: 4 條 Given-When-Then + DoD → [md](ac/M00-US-131.md) ｜ [html](ac/M00-US-131.html)
- **業務規則**: 推播 payload 只准包含任務摘要（唔准塞完整 transcript）；音頻經 URL（唔內嵌，APNs payload 4KB 上限）；iOS 附件音頻 ≤ 30 秒（用 ≤ 30 字摘要）；憑證唔落 repo（放 AWS Secrets Manager）
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
- **實測結論**: 已完成（AWS 側 ＋ 代碼側）：AWS Budgets 月度 $5 預算（80% 電郵 ＋ 100% SNS 告警）、SNS 成本告警 topic、CloudWatch 用量 dashboard（Lambda invocations/errors、SQS messages、DynamoDB consumed capacity）；單任務預算上限代碼（runtime/sidecar/src/budget-guard.ts）：時間上限（預設 15 分鐘，可喺環境變數調）＋ token 上限 → 超限即 abort session → 標 partial → 通知，9 條探針覆蓋。**未做**：用量聚合 API（dashboard 用 CloudWatch 原生指標代替）。
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
- **實測結論**: plugin 機制已通並跑咗兩個實例：tauri-plugin-ios-stt（SFSpeechRecognizer 粵語）＋ tauri-plugin-ios-qrscan（AVCaptureMetadataOutput）。關鍵位：① build.rs 用 `.ios_path("ios")`（自動 copy Tauri Swift API 去 .tauri/tauri-api ＋ 編譯 Swift package ＋ emit link 路徑）② `tauri::ios_plugin_binding!` FFI ③ Swift `@_cdecl("init_plugin_xxx")`。踩過嘅坑：Swift 唔可以將 UIView 加落 window（UIKit 斷言 → SIGABRT）；present() 喺 Tauri root VC 會崩；startRunning() 唔可以喺主執行緒；Xcode build phase 唔繼承 shell 環境變數（要用 cargo [env]）。**未做**：local TTS plugin、push plugin（要憑證）
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
- **實測結論**: session 持久化已做：Pi SDK `SessionManager.create(cwd)`（file-backed，存喺 Mac 本地）＋ `SessionManager.list()`（session 切換 UI）＋ `SessionManager.open(path)`（fork／續接）。transcript 對齊用 DynamoDB（cursor 必須包 role：ts#requestId#role —— 同一毫秒內 user+agent 會撞 key，實測踩過）。Pi SDK 版本釘死 1.4.0。**未做**：Pi SDK 大版本升級嘅相容性測試（等有新版本先做）
- **為什麼這個優先**: P2：session 係長對話體驗嘅地基；版本相容唔理會喺 SDK 升級嗰日先爆，就會連帶用戶資料讀唔到。
- **需求錨點**: [req/TECH-402-requirement.md](req/TECH-402-requirement.md)

---

## 相關文件

- 術語表: `docs/glossary_list.md`
- 專案根目錄: `docs/backlog.md`（本檔）

> 模組切割（Module）同批次清單由 `dav-designer` 設計階段回填；planner 唔預設。
