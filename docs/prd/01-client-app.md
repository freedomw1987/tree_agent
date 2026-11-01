# PRD 01 — M01 client-app（Tauri 2 跨端 App）

> Module: `M01` ｜ SP: 37（含 SPIKE-002/003 = 6）｜ 批次: 3 ｜ Surface: `mobile-app`, `desktop-mac`
> 對應 backlog: `docs/backlog.md`（US-101, US-102, US-105, US-131, US-132, TECH-401, SPIKE-002, SPIKE-003）
> 對應設計: `docs/DESIGN.md` §2.1/§2.2/§6.1/§6.2 ｜ 架構: `docs/system-design.md` §3

## 1. 目標

畀用戶一個「WeChat 式」介面：單手按住講嘢 → Agent 做事 → 完成時主動通知（語音）。同一套 code 跑 iOS / Android / macOS。

## 2. FR 清單

| FR | 描述 | 驗收條件（AC） |
|---|---|---|
| **FR-M01-01** | 對話訊息串（用戶右 / Agent 左、氣泡、時間戳、狀態點：已送出／已送達／失敗） | Given 有訊息 When 開啟對話 Then 氣泡方向正確且顯示時間；狀態點反映 ack／失敗 |
| **FR-M01-02** | 文字輸入列 + 發送（輸入列可摺疊） | Given 有文字 When 撳發送 Then 訊息即刻出現並顯示「已送出」 |
| **FR-M01-03** | 語音輸入：錄音鍵 + waveform + 計時 + STT 可編輯文字 +「聽唔清」提示 + 60 秒上限 | Given 按住講嘢 When 放開 Then 顯示可編輯文字；STT 空結果唔送出；≥60 秒自動停 |
| **FR-M01-04** | 語音回覆播放（Polly mp3）：播報鈕 + 播放狀態 + TTS 失敗降級為文字 | Given 有回覆 When 撳播報 Then 播放 mp3；TTS 失敗顯示提示但文字照常 |
| **FR-M01-05** | 任務卡片（完成／失敗／partial、耗時、交付物全文、重試） | Given 任務結束 When 回應 Then 卡片顯示對應狀態同交付物 |
| **FR-M01-06** | 確認卡（預覽 diff/payload、風險徽章、5 分鐘倒數、確認／取消） | Given Agent 要求 write 操作 Then 卡片出現並倒數；過期自動取消 |
| **FR-M01-07** | 完成推播 + 語音通知（APNs/FCM）+ 安靜模式 | Given App 喺背景 When 任務完成 Then 收到推播（靜音時只文字） |
| **FR-M01-08** | 每日任務數統計（今日任務數 + 節省輸入時間 + 明細） | Given 今日有任務 When 睇統計 Then 顯示正確數字（同 request_id 只計一次）；明細表分頁（每頁 20 條），超過 200 條用虛擬捲動 |
| **FR-M01-09** | 設定（登入 token、語音輸入開關、語音回覆開關、安靜模式、推播權限狀態） | Given 開關切換 When 離開頁面 Then 設定保留並生效 |
| **FR-M01-10** | 五狀態（Loading / Empty / Error / Edge）對應元件 | 見 `docs/DESIGN.md` §8 M01 行 |
| **FR-M01-12** | 對話 session 入口：Header 對話 chip（顯示當前 session）＋ 抽屜 Sheet（列出對話、標明當前、可切換、「開新對話」）；跨 session 訊息標明所屬對話 | Given 手機對話畫面 When 撳 chip Then 抽屜列出所有對話；開新後當前 session 即時切換、舊對話保留；跨 session 訊息有標記 |
| **FR-M01-13** | 黏底行為：新訊息到達時，喺底部就自動滾到底；唔喺底部就出「新訊息」按鈕（撳咗先滾落去） | Given 喺底部 When 新訊息到達 Then 自動見到最新訊息；Given 拖拉到上方 When 新訊息到達 Then 位置唔被搶走 + 底部有「新訊息」按鈕，撳咗先滾到底 |
| **FR-M01-11** | Tauri mobile native plugin 層（STT / local TTS / push）——TECH-401 | Given 平台無內建能力 When 呼叫 plugin Then Rust 介面穩定、UI 層唔受平台細節影響 |

## 3. 依賴關係

- **上游**：M02（Relay API 端點）、M03（sidecar 狀態）、SPIKE-002（STT 數據）、SPIKE-003（push 可行性）
- **下游**：M04（確認卡 UI 依賴 M01 呈現確認請求）、M05（同上）
- **平台依賴**：Tauri 2 mobile 工具鏈、APNs/FCM 憑證、麥克風權限

## 4. 五狀態（DoD-Full）

| 狀態 | 落點 | 呈現 |
|---|---|---|
| Happy | 語音任務流 | 錄音 → STT 草稿 → 送出 → 任務卡 → 播報 |
| Loading | 錄音中／訊息傳送中／task 卡讀取中 | waveform + 計時、骨架屏、CTA disable（≥300ms） |
| Empty | 未傾過偈、未做過任務 | 圖示 + 引導文案 +「按住下面個掣開始」 |
| Error | Agent 離線、網絡斷、推播失敗、TTS 失敗 | 頂部條幅 + 具體修正建議 + 重試 |
| Edge | 錄音 ≥60 秒、STT 空、極長訊息、同一 request 重送 | 自動中止／截斷／去重提示 |

## 5. 追溯矩陣

| FR | User Story | Surface | 畫面路由 | Demo 步驟 | 狀態 |
| --- | --- | --- | --- | --- | --- |
| FR-M01-01 對話訊息串 | M00-US-101 | mobile-app | /m/chat | step-1 | ✅ 已原型 |
| FR-M01-02 文字輸入列 | M00-US-101 | mobile-app | /m/chat | step-1 | ✅ 已原型 |
| FR-M01-03 語音輸入 | M00-US-102 | mobile-app | /m/chat | step-1 | ✅ 已原型 |
| FR-M01-04 語音回覆播放 | M00-US-105 | mobile-app | /m/chat | step-4 | ✅ 已原型 |
| FR-M01-05 任務卡片 | M00-US-106 | mobile-app | /m/chat | step-4 | ✅ 已原型 |
| FR-M01-06 確認卡 | M00-US-113 | mobile-app | /m/chat | step-5 | ✅ 已原型 |
| FR-M01-07 完成推播 + 語音通知 | M00-US-131 | mobile-app | /m/settings | — | ✅ 已原型 |
| FR-M01-08 每日任務數 | M00-US-132 | mobile-app | /m/stats | step-8 | ✅ 已原型 |
| FR-M01-09 設定 | M00-US-104 | mobile-app | /m/settings | — | ✅ 已原型 |
| FR-M01-10 五狀態 | M00-US-102 | mobile-app | /m/chat | — | ✅ 已原型 |
| FR-M01-11 native plugin 層 | TECH-401 | desktop-mac | /d/runtime | — | ✅ 已原型 |
| FR-M01-12 對話 session 入口 | M00-US-101 | mobile-app | /m/chat | step-9 | ✅ 已原型 |
| FR-M01-13 黏底 + 新訊息按鈕 | M00-US-101 | desktop-mac | /d/chat | — | ✅ 已原型 |
| FR-M01-01 對話（寬版） | M00-US-101 | desktop-mac | /d/chat | — | ✅ 已原型 |
| FR-M01-08 統計（大屏） | M00-US-132 | desktop-mac | /d/stats | — | ✅ 已原型 |
| FR-M01-09 權限狀態 | M00-US-102 | desktop-mac | /d/runtime | — | ✅ 已原型 |
