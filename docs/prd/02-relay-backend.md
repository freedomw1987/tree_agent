# PRD 02 — M02 relay-backend（AWS 中轉層）

> Module: `M02` ｜ SP: 14（含 SPIKE-001 = 3）｜ 批次: 2 ｜ Surface: `cli-terminal`（觀察面）
> 對應 backlog: `docs/backlog.md`（US-104, US-141, SPIKE-001；US-105/131 server 側）
> 對應設計: `docs/DESIGN.md` §6.3 ｜ 架構: `docs/system-design.md` §2/§3/§5

## 1. 目標

一個**薄**中轉層：App 同 Mac 之間嘅唯一通道 + transcript 真相 + 認證 + TTS + 推播 + 成本守衛。**本 Module 唔執行 Agent、唔持有 Workspace 憑證。**

## 2. FR 清單

| FR | 描述 | 驗收條件（AC） |
|---|---|---|
| **FR-M02-01** | 認證 authorizer（AuthProvider 實作：單用戶自製 token） | Given 無效 token When 呼叫 Then 401 + 明確錯誤碼；App 顯示「請重新登入」而非 5xx |
| **FR-M02-02** | 訊息收發 API（`request_id` 冪等、ack ≤ 2 秒） | Given 同一 `request_id` 送兩次 Then 只入庫一次、只派發一次任務 |
| **FR-M02-03** | transcript 持久化（user_id / request_id / role / content / kind / ts） | Given 任一訊息 When 落庫 Then 增量拉取（cursor）唔漏唔重 |
| **FR-M02-04** | transport（App ↔ Sidecar 投遞）—— SPIKE-001 選型 | Given 選型落地 Then 端到端延遲 ≤ 5 秒（p50）、閒置零常駐成本 |
| **FR-M02-05** | TTS job（Polly → mp3 → S3，24h cache，同文字只合一次） | Given 同一段文字兩次請求 Then 只產生一次 mp3 |
| **FR-M02-06** | push dispatcher（APNs/FCM，只載任務摘要 + mp3 URL） | Given 任務完成 Then 收到推播；payload 唔包含完整 transcript |
| **FR-M02-07** | 成本守衛（預算 alarm、單任務預算上限中止、用量聚合） | Given 單任務超預算 When 觸發 Then 中止 → partial → 通知 |
| **FR-M02-08** | 每日任務數聚合（冪等：同 request_id 只計一次） | Given 重試過任務 When 聚合 Then 任務數只 +1 |
| **FR-M02-09** | Token 更換 / 重新授權流程（單用戶 token 遺失或過期時可恢復） | Given token 失效 When App 顯示「請重新登入」Then 有可執行嘅重新授權路徑（唔會鎖死用戶入不了系統） |

## 3. 依賴關係

- **上游**：AWS 帳戶（Lambda / DynamoDB / S3 / IAM）、SPIKE-001（transport 選型）
- **下游**：M01（App client）、M03（Sidecar client）、M04（AuthProvider 實作喺呢度，介面喺 M04）
- **不依賴**：M03 唔可以反向依賴 DynamoDB 內部結構（只經 API）

## 4. 五狀態（DoD-Full）

| 狀態 | 落點 | 呈現 |
|---|---|---|
| Happy | 投遞 + ack + transcript 落庫 | cli-terminal 出 `[relay] delivered` 行 |
| Loading | 佇列 pending | `[relay] queued`，pending 計數 |
| Empty | 未有送達紀錄 | 「仲未有任務送達過」 |
| Error | token 失效 / relay 逾時 | `[error] 401 unauthorized` / timeout 行 |
| Edge | `request_id` 重送 | `[relay] duplicate request_id → deduped` |

## 5. 追溯矩陣

| FR | User Story | Surface | 畫面路由 | Demo 步驟 | 狀態 |
| --- | --- | --- | --- | --- | --- |
| FR-M02-01 認證 authorizer | M00-US-104 | cli-terminal | /t/console | — | ✅ 已原型 |
| FR-M02-02 訊息收發 + 冪等 | M00-US-104 | cli-terminal | /t/console | step-2 | ✅ 已原型 |
| FR-M02-03 transcript 持久化 | M00-US-104 | cli-terminal | /t/console | step-2 | ✅ 已原型 |
| FR-M02-04 transport 投遞 | SPIKE-001 | cli-terminal | /t/console | step-2 | ✅ 已原型 |
| FR-M02-05 TTS job | M00-US-105 | cli-terminal | /t/console | — | ✅ 已原型 |
| FR-M02-06 push dispatcher | M00-US-131 | cli-terminal | /t/console | step-4 | ✅ 已原型 |
| FR-M02-07 成本守衛 | M00-US-141 | cli-terminal | /t/console | — | ✅ 已原型 |
| FR-M02-08 每日任務數聚合 | M00-US-132 | mobile-app | /m/stats | step-8 | ✅ 已原型 |
| FR-M02-09 Token 更換 / 重新授權 | M00-US-104 | mobile-app | /m/settings | — | ✅ 已原型 |
