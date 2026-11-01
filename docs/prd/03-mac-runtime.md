# PRD 03 — M03 mac-runtime（Mac sidecar + Pi SDK）

> Module: `M03` ｜ SP: 13 ｜ 批次: 1（最先做）｜ Surface: `desktop-mac`, `cli-terminal`
> 對應 backlog: `docs/backlog.md`（US-103, TECH-402）
> 對應設計: `docs/DESIGN.md` §2.2/§2.3/§6.2/§6.3 ｜ 架構: `docs/system-design.md` §2/§3/§6

## 1. 目標

全系統**唯一**執行 Pi SDK 嘅地方。App 唔會直接跑 Agent；App 只係「發訊息 + 睇結果」。呢個 Module 決定咗「Agent 真正做嘢」嘅地基。

## 2. FR 清單

| FR | 描述 | 驗收條件（AC） |
|---|---|---|
| **FR-M03-01** | sidecar 啟動：spawn Node/Bun process、載入 Pi SDK、建立 session（cwd = Workspace） | Given macOS App 啟動 Then session 建立成功、App 顯示「Agent 已就緒」、`ps` 無孤兒 process |
| **FR-M03-02** | IPC 橋：Rust ↔ sidecar；prompt 送入、streaming delta 出、session 事件出 | Given 一段 prompt When 經 IPC 送入 Then 收到 streaming 片段並即時轉發 Relay |
| **FR-M03-03** | 崩潰偵測 + 自動重啟（≤ 5 秒）+ App 提示 | Given sidecar 被 kill When supervisor 偵測 Then 自動重啟、session 由磁碟恢復、App 顯示「Agent 已重啟」 |
| **FR-M03-04** | session 持久化（file-backed SessionManager，本地）+ Pi SDK 版本 pin | Given 重啟 sidecar When 續 session Then 歷史保留；版本升級必過回歸 |
| **FR-M03-05** | Workspace 管理（選擇／切換／預設 `~/agent-workspace`、不存在時提示建立） | Given 揀新路徑 When 生效 Then session cwd 跟住變、檔案工具範圍同步更新 |
| **FR-M03-06** | Sidecar ↔ Relay client（獨立憑證，唔用 App token） | Given sidecar 上線 Then 用自己身份取任務；App token 泄露唔影響 Agent 身份 |
| **FR-M03-07** | 生命週期與保留期策略（Mac 睡眠／熄屏時 sidecar 點保持；session / audit log 保留期可配置） | Given Mac 進入睡眠 When 策略生效 Then 恢復後 sidecar 自動接返、session 唔損毀；保留期到期自動清理 |

## 3. 依賴關係

- **上游**：Pi SDK（Node ≥ 20 / Bun）、Tauri sidecar 機制、M02 Relay（取任務）
- **下游**：M04（工具層裝喺 session 內）、M05（工具需要 Workspace）
- **風險**：Mac 睡眠／熄屏 → 影響「離開屋企仲能不能用」（OQ-5，**必須喺批次 1 開工前答**，因為屬 runtime 生命週期）

## 4. 五狀態（DoD-Full）

| 狀態 | 落點 | 呈現 |
|---|---|---|
| Happy | Agent 就緒 + streaming 輸出 | `/d/runtime` 綠色狀態卡；cli-terminal 逐段輸出 |
| Loading | sidecar 啟動中 | 骨架屏 + 「啟動中…」 |
| Empty | 未選 Workspace | 提示揀 Workspace |
| Error | sidecar 崩潰 | 紅色狀態卡 + 自動重啟倒數 + 錯誤摘要 |
| Edge | session 檔損毀 / Workspace 路徑不存在 | 分別提示「新建 session」/「路徑不存在，建立？」 |

## 5. 追溯矩陣

| FR | User Story | Surface | 畫面路由 | Demo 步驟 | 狀態 |
| --- | --- | --- | --- | --- | --- |
| FR-M03-01 sidecar 啟動 | M00-US-103 | desktop-mac | /d/runtime | step-3 | ✅ 已原型 |
| FR-M03-02 IPC 橋 | M00-US-103 | cli-terminal | /t/console | step-2 | ✅ 已原型 |
| FR-M03-03 崩潰重啟 | M00-US-103 | desktop-mac | /d/runtime | — | ✅ 已原型 |
| FR-M03-04 session 持久化 | TECH-402 | cli-terminal | /t/console | — | ✅ 已原型 |
| FR-M03-05 Workspace 管理 | M00-US-103 | desktop-mac | /d/runtime | step-3 | ✅ 已原型 |
| FR-M03-06 Sidecar 身份 | M00-US-104 | cli-terminal | /t/console | step-2 | ✅ 已原型 |
| FR-M03-07 生命週期 / 保留期 | TECH-402 | desktop-mac | /d/runtime | — | ✅ 已原型 |
