# PRD 05 — M05 tool-catalog（外部服務 + 檔案 + terminal）

> Module: `M05` ｜ SP: 21 ｜ 批次: 5（最後做）｜ Surface: `mobile-app`, `desktop-mac`, `cli-terminal`
> 對應 backlog: `docs/backlog.md`（US-112, US-121, US-122）
> 對應設計: `docs/DESIGN.md` §8 M05 行 ｜ 架構: `docs/system-design.md` §3/§7/§9

## 1. 目標

三類「真係識做嘢」嘅工具。全部必須經 M04 Risk Gate 註冊先可以執行；憑證全部留喺你部 Mac。

## 2. FR 清單

| FR | 描述 | 驗收條件（AC） |
|---|---|---|
| **FR-M05-01** | 外部服務工具（首個 target 待定 → OQ-1；憑證留 Mac 本地 / keychain） | Given 選定 target When 註冊工具 Then 可被 Agent 調用並回傳真實資料；憑證唔出現喺 log／transcript |
| **FR-M05-02** | 檔案工具（read / write / search），路徑鎖死 Workspace 根目錄，> 1MB 截斷 | Given 路徑含 `..` When 讀取 Then 拒絕；Given 寫入 Then 先要確認並顯示 diff |
| **FR-M05-03** | terminal 工具：唯讀命令自動、其餘需確認、危險黑名單、60 秒超時、輸出截斷 200 行 | Given `rm -rf` When 調用 Then 攔截並要求確認；Given >60 秒 Then 中止無野生 process |
| **FR-M05-04** | 工具錯誤結構化回報（唔好 crash sidecar） | Given 檔案唔存在／冇權限 When 讀取 Then 回傳結構化錯誤，sidecar 仍存活 |

## 3. 依賴關係

- **上游**：M04（註冊 + Risk Gate + audit）、M03（Workspace 路徑、憑證存檔）
- **下游**：無（終端 Module）
- **Open question**：OQ-1（第一個外部服務 target）未答之前，US-112 唔開工

## 4. 五狀態（DoD-Full）

| 狀態 | 落點 | 呈現 |
|---|---|---|
| Happy | 工具執行成功 + audit | `/d/tools` 有紀錄；手機任務卡片顯示交付物 |
| Loading | 工具執行中 | `[tool] running…` 行 + spinner |
| Empty | 未註冊任何工具 | 「仲未有工具」 |
| Error | 憑證失效／檔案不存在／命令拋錯 | 結構化錯誤 + 具體修正建議 |
| Edge | `rm -rf` 攔截 / 60 秒超時 / 200 行截斷 / 路徑逃逸 | 對應 audit 記錄 + 明確提示 |

## 5. 追溯矩陣

| FR | User Story | Surface | 畫面路由 | Demo 步驟 | 狀態 |
| --- | --- | --- | --- | --- | --- |
| FR-M05-01 外部服務工具 | M00-US-112 | desktop-mac | /d/tools | — | ✅ 已原型 |
| FR-M05-02 檔案工具 | M00-US-121 | desktop-mac | /d/tools | step-7 | ✅ 已原型 |
| FR-M05-03 terminal 工具 | M00-US-122 | cli-terminal | /t/console | step-6 | ✅ 已原型 |
| FR-M05-04 結構化錯誤 | M00-US-121 | cli-terminal | /t/console | — | ✅ 已原型 |
| FR-M05-03 危險命令攔截 | M00-US-122 | mobile-app | /m/chat | step-5 | ✅ 已原型 |
