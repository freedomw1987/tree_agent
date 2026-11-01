# PRD 04 — M04 tool-governance（工具層 + Risk Gate + 確認）

> Module: `M04` ｜ SP: 15 ｜ 批次: 4 ｜ Surface: `mobile-app`, `cli-terminal`, `desktop-mac`
> 對應 backlog: `docs/backlog.md`（US-111, US-113, US-106）
> 對應設計: `docs/DESIGN.md` §3.2/§8 ｜ 架構: `docs/system-design.md` §3/§9

## 1. 目標

Agent 自主執行嘅**唯一防線**：每個工具一定要標風險級別，read_only 自動做，write / external_effect 一定要你確認。所有調用留痕。

## 2. FR 清單

| FR | 描述 | 驗收條件（AC） |
|---|---|---|
| **FR-M04-01** | 工具註冊 + `risk_level` 標籤（`read_only` / `write` / `external_effect`） | Given 工具冇標籤 When 註冊 Then 拒絕啟用 |
| **FR-M04-02** | Risk Gate 執行：read_only 自動；write / external_effect 攔截並等確認 | Given write 工具 When Agent 調用 Then 未確認前唔會執行 |
| **FR-M04-03** | 確認卡流程（預覽 diff/payload → 確認／取消 → 5 分鐘有效 → 語音「confirm」等效） | Given 5 分鐘冇處理 When 過期 Then 自動取消並記錄 |
| **FR-M04-04** | audit log（tool / args digest / risk_level / 結果 / ts） | Given 任何工具調用 When 完成 Then audit log 有完整一筆；表格分頁（每頁 50 條）+ 工具名過濾（避免長 log 變雜訊） |
| **FR-M04-05** | AuthProvider 抽象（介面喺 M04，單用戶實作喺 M02，將來可加 Cognito） | Given 換 provider When 呼叫 Then App 呼叫層唔使改 |
| **FR-M04-06** | 內容產出任務流程（read-only 工具 → 交付物 → 落 transcript；30 秒內見到完成） | Given 一句內容產出指令 When 執行 Then 交付物全文可讀且入 transcript |
| **FR-M04-07** | 任務預算（單任務時間／token 上限，超時標 partial 並通知） | Given 任務超上限 When 觸發 Then 中止 + partial + 通知 |

## 3. 依賴關係

- **上游**：M03（工具層裝喺 session 內）、M02（AuthProvider 實作、確認請求投遞）
- **下游**：M05（所有具體工具必須經 M04 註冊先可以執行）
- **安全**：呢個 Module 唔可以被繞過 —— M05 唔准直連執行

## 4. 五狀態（DoD-Full）

| 狀態 | 落點 | 呈現 |
|---|---|---|
| Happy | 確認 → 執行 → audit | 手機確認卡 + cli-terminal `[tool]` 行 |
| Loading | 等待確認（倒數）／工具執行中 | 倒數條 + spinner |
| Empty | 冇待確認操作 | 「冇需要你確認嘅操作」 |
| Error | 工具拋錯／取消／過期 | 任務卡片 failed + 具體原因 |
| Edge | 語音 confirm、連續兩張卡、危險命令 | 對應提示 + audit 記錄 |

## 5. 追溯矩陣

| FR | User Story | Surface | 畫面路由 | Demo 步驟 | 狀態 |
| --- | --- | --- | --- | --- | --- |
| FR-M04-01 工具註冊 + risk_level | M00-US-111 | cli-terminal | /t/console | step-6 | ✅ 已原型 |
| FR-M04-02 Risk Gate 攔截 | M00-US-111 | mobile-app | /m/chat | step-5 | ✅ 已原型 |
| FR-M04-03 確認卡流程 | M00-US-113 | mobile-app | /m/chat | step-5 | ✅ 已原型 |
| FR-M04-04 audit log | M00-US-111 | desktop-mac | /d/tools | step-7 | ✅ 已原型 |
| FR-M04-05 AuthProvider 抽象 | M00-US-111 | desktop-mac | /d/runtime | — | ✅ 已原型 |
| FR-M04-06 內容產出任務 | M00-US-106 | mobile-app | /m/chat | step-4 | ✅ 已原型 |
| FR-M04-07 任務預算 | M00-US-141 | cli-terminal | /t/console | — | ✅ 已原型 |
