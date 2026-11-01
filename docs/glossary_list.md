# Voice Agent App Glossary（術語表）

> A-Z 排序（英文術語按大小寫唔敏感）｜用途：各階段同用戶用同一套詞語 ｜ 來源：dav-planner 規劃階段提問整理（2026-11-01）

| 術語 | 定義（一句，≤ 40 字）| 同義寫法（同一件事嘅其他講法）|
|------|----------------------|------------------------|
| APNs（Apple Push Notification service）| Apple 嘅 iOS 推播服務，送 device token | 蘋果推播 |
| AuthProvider（認證提供者）| 認證抽象層，可換實作（自製 token → Cognito）| 認證層、登入模組、auth adapter |
| AWS Polly（雲端文字轉語音）| 雲端 TTS 服務，合成 mp3 供語音回覆／語音通知 | Polly、語音合成、cloud TTS |
| Daily Task Count（每日任務數）| 核心成功指標：每日完成任務嘅數量 | 每日任務、任務數、daily tasks |
| FCM（Firebase Cloud Messaging）| Android 推播服務，送 device token | Firebase 推播 |
| Pi SDK（Agent 執行框架）| `@earendil-works/pi-coding-agent`，in-process 跑 Agent | pi sdk、pi 框架、pi agent |
| Relay（中轉層）| AWS 上嘅薄中轉層：訊息來回 + 持久化，唔執行 Agent | 中轉、轉發層、message broker |
| Request ID（冪等鍵）| 每個任務嘅唯一鍵（UUID），保證重試唔重複執行 | request id、冪等 id、task id |
| Risk Gate（風險閘）| 工具風險分級：read_only 自動做、write／external_effect 先確認 | 風險閘、確認機制、風險分級 |
| Sidecar（常駐副程序）| Mac 上跑 Pi SDK 嘅 Node/Bun process，由 Tauri sidecar 托管 | sidecar、副程序、agent process |
| STT（語音轉文字）| device native 語音辨識（iOS Speech／Android SpeechRecognizer）| 語音辨識、speech to text、轉錄 |
| Tauri 2（跨平台 App 框架）| 一套 code 跑 iOS／Android／macOS；Rust core + WebView UI | Tauri |
| Terminal Tool（終端機工具）| Agent 執行 shell 命令嘅工具（危險命令需確認）| 終端機、command 工具、shell 工具 |
| Transcript（對話紀錄）| 用戶同 Agent 嘅訊息歷史（持久化喺 DynamoDB）| 對話紀錄、聊天記錄、訊息歷史 |
| TTS（文字轉語音）| 文字轉語音；本專案用 AWS Polly 喺雲端合成 | 語音回覆、讀出、speak back |
| Workspace（工作區）| Mac 上 Agent 可操作嘅目錄（預設 `~/agent-workspace`）| workspace、工作目錄、專案目錄 |

## 勿用寫法（會指錯嘢，唔好當同義詞用）

| 勿用寫法 | 應該寫 |
|----------|--------|
| 「Lambda 做 agent」 | 「AWS 做 relay，agent runtime 喺 Mac」 |
| 「電腦版 App」 | 「macOS App」 |
| 「微信」 | 「WeChat 式對話介面」 |
| 「語音助手」 | 「語音輸入（STT）／語音回覆（TTS）」——兩者唔同，唔好混 |
| 「任務完成」 | 「任務完成（成功且用戶冇反對；partial 唔計）」 |
| 「workspace」 | 「Workspace（工作區）——指 Mac 本地目錄」 |
