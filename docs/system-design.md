# system-design.md — Voice Agent App 系統架構

> 產出：dav-designer Step 3（2026-11-01）｜對應 backlog：`docs/backlog.md`｜對應設計：`docs/DESIGN.md`
> ⚠️ 本檔只描述「點解咁切」同「點互動」，**唔含真實程式碼**（實作留俾 `dav-developer`）。

---

## 1. 技術棧

| 層 | 技術 | 備註 |
|---|---|---|
| App（iOS / Android / macOS） | Tauri 2 + Rust core + TypeScript 前端 | 一套 code 三端；Rust 負責長連線、檔案、推播註冊 |
| 平台原生橋 | Swift（iOS/macOS）+ Kotlin（Android）plugin | STT / local TTS / push（Tauri 冇官方 mobile plugin，見 `TECH-401`） |
| Mac runtime | Tauri macOS App 內 sidecar = Node ≥ 20 或 Bun process | 內嵌 `@earendil-works/pi-coding-agent`，in-process 跑 Agent |
| Agent 執行 | Pi SDK（`createAgentSession` / `SessionManager` / streaming events） | session 存 Mac 本地 |
| AWS 中轉 | Lambda（authorizer / push / TTS）+ DynamoDB（transcript）+ S3（mp3）+ transport（SPIKE-001 選型） | 只做中轉，**唔執行 Agent** |
| 語音 | STT = device native（iOS Speech / Android SpeechRecognizer）；TTS = AWS Polly | 粵語 zh-HK 為主 |
| 推播 | APNs（iOS/macOS）+ FCM（Android），由 Lambda 直接發 | 憑證存 AWS Secrets Manager |
| 原型 demo | Vite + React + TS + Tailwind + shadcn/ui + HashRouter + zustand(persist) + vite-plugin-singlefile | `prototype/voice-agent/` |

---

## 2. 系統組成部件（純文字）

```
┌──────────────────────────────┐        ┌──────────────────────────────┐
│ mobile-app (Tauri 2)         │        │ desktop-mac (Tauri 2)        │
│ 對話 / 錄音 / STT / 確認卡    │        │ 對話(寬) / Agent / 工具 / 統計 │
│ 設定 / 統計 / 通知            │        │                              │
└───────────┬──────────────────┘        └──────────┬───────────────────┘
            │  HTTPS + token                      │  HTTPS + token
            │  (send msg / poll-or-subscribe)     │
            ▼                                    ▼
┌───────────────────────────────────────────────────────────────┐
│ M02 relay-backend（AWS 薄中轉層）                              │
│  · authorizer（AuthProvider：單用戶自製 token）                 │
│  · messages API（request_id 冪等、ack）                        │
│  · transcript store（DynamoDB：user_id / request_id / role / …） │
│  · transport（SPIKE-001 選型：AppSync Events / SQS long-poll /   │
│    API Gateway WebSocket）                                     │
│  · TTS job（Polly → mp3 → S3，24h cache）                      │
│  · push dispatcher（APNs / FCM，只載任務摘要）                   │
│  · cost guard（預算 alarm、單任務預算上限、用量聚合）             │
└───────────┬───────────────────────────────────────────────────┘
            │  claim / deliver  ← 只投遞「任務」，唔帶憑證
            ▼
┌───────────────────────────────────────────────────────────────┐
│ M03 mac-runtime（你部 Mac）                                    │
│  Tauri macOS App                                               │
│   └─ sidecar (Node/Bun)                                        │
│        └─ Pi SDK session（cwd = Workspace，file-backed）        │
│             └─ M04 tool-governance（Risk Gate / 確認 / audit）   │
│                  └─ M05 tool-catalog（外部服務 / 檔案 / terminal）│
└───────────────────────────────────────────────────────────────┘
```

---

## 3. Module 邊界（Module 邊界 = 測試邊界）

> 探針只針對本 Module 嘅介面同內部狀態，唔跨 Module 檢查。

| Module | 職責（一句） | 擁有嘅狀態 | 對外介面 | 唔做 |
|---|---|---|---|---|
| **M01 client-app** | 三端 UI 殼：對話、語音輸入、語音回覆、通知、統計 | 本機 UI 狀態、權限狀態、session 選取 | Relay API（send / fetch transcript / confirm）、推播註冊 | 唔做 Agent 邏輯、唔存 transcript 真相 |
| **M02 relay-backend** | 訊息中轉、認證、持久化、TTS、推播、成本守衛 | DynamoDB transcript、任務狀態、TTS cache | HTTP/WS 端點（App + Sidecar 兩種 client） | **唔執行 Agent**、唔持有 Workspace 憑證 |
| **M03 mac-runtime** | 唯一執行 Pi SDK 嘅地方：sidecar、session（持久化 ＋ 自動分流 ＋ 自動命名）、Workspace | Workspace 路徑、session 檔、當前 session、sidecar process | IPC（Rust ↔ sidecar）、Relay 認證後的 client、工具註冊表、session 分流結果 | 唔畫 UI（只用 minimal 狀態 UI）、唔直接碰 AWS 持久化 |
| **M04 tool-governance** | 工具風險分級＋Risk Gate＋確認流程＋audit log＋AuthProvider 抽象 | risk_level 註冊表、確認卡狀態、audit log | 工具註冊 API、確認請求/回覆 API、AuthProvider 介面 | 唔實作具體工具（落 M05）、唔決定 Agent 咩時候用工具 |
| **M05 tool-catalog** | 具體工具：外部服務、檔案、terminal | 工具參數 schema、憑證引用（Mac 本地） | 註冊到 M04 嘅工具表 | 唔繞過 Risk Gate、唔將憑證離開 Mac |

### 3.1 Module 依賴（單向）

`M01 → M02`（App 只識 Relay API）
`M02 ⇄ M03`（Relay 派任務 → Sidecar 執行 → 回傳結果；兩邊各有各嘅認證）
`M03 → M04 → M05`（Sidecar 裝工具層，再裝具體工具）
`M04 → M02`（AuthProvider 由 M02 提供實作，介面喺 M04）

> 循環依賴（App ↔ Relay）靠「ack + 冪等 request_id」解開，唔靠同步往返。

---

## 4. Surface 邊界

| Surface | 用邊套 UI 組件 | 用邊套 API | 唔做 |
|---|---|---|---|
| `mobile-app` | shadcn：button / card / input / badge / sheet / tabs / switch / skeleton / alert；自建：PhoneFrame / MessageBubble / VoiceRecorder / TaskCard / ConfirmCard | M01 的 client 層（包住 M02 端點） | 唔顯示 Workspace / session / audit log（桌面先有） |
| `desktop-mac` | shadcn：table / tabs / dialog / dropdown-menu / tooltip / progress；自建：DesktopShell / StatCard / RiskBadge | 同上 + M03 runtime 狀態（M03 自己嘅 IPC 介面） | 唔做檔案管理（只揀 Workspace） |
| `cli-terminal` | 純等寬字 view（無 shadcn 表單組件） | M03 sidecar stdout 事件流 | 唔可互動（純診斷面） |

---

## 5. 資料流

### 5.1 語音任務流（主流程）

| # | 發生喺 | 事件 | 資料 |
|---|---|---|---|
| 1 | M01 | 用戶放開錄音鍵 | 音訊（**唔上傳**）→ device STT → 可編輯文字 |
| 2 | M01 | 送出 | `sendMessage(text, request_id=UUID)` → M02 |
| 3 | M02 | 驗證 token | 401 → M01 顯示「請重新登入」 |
| 4 | M02 | 落庫 + 派發 | transcript row（role=user）+ 投遞任務 → M03 |
| 5 | M02 → M01 | ack | 氣泡狀態「已送達」 |
| 6 | M03 | 執行 | sidecar 收到任務 → Pi SDK session → streaming delta → 回傳 M02 → M01 追加氣泡 |
| 7 | M03 | 完成 | 結果落 transcript + 任務狀態 = completed |
| 8 | M02 → 裝置 | 推播 | APNs/FCM（摘要 payload + mp3 URL）→ M01 顯示通知 |

### 5.2 高風險確認流

M03 工具調用 → M04 Risk Gate 判定 `write`/`external_effect` → M04 產生確認卡狀態 → M02 投遞確認請求 → M01 顯示確認卡（5 分鐘倒數）→ 用戶確認（撳／語音「confirm」）→ M02 回覆確認結果 → M03 執行 → M04 寫 audit log → 結果回傳。

### 5.3 冪等與重試

- `request_id` 由 M01 產生並持久化（本地）→ 重試用同一個 → M02 dedupe → M03 唔會重複執行。
- Sidecar 認證同 App 認證分開（各自 token / client credentials）→ 令 Sidecar 唔需要用 App token。
- 網絡中斷 → M01 重連後按 `last_seen_cursor` 補拉 transcript（M02 提供增量讀取）。

### 5.4 對話 session 分流（新增 — M03 決策，M01 只提供入口）

| 情況 | 行為 | 用戶感覺 |
|---|---|---|
| 新訊息屬於現有 session 話題 | 續用該 session（`switchSession` / 沿用 active session） | 唔使做任何嘢 |
| 新訊息屬於新話題 | 開新 session 並自動命名（`newSession` + Agent 生成標題） | 唔使做任何嘢，見到「對話：XXX」chip 轉咗 |
| 用戶想新開 | 「開新對話」按鈕（手機抽屜 / 桌面左欄） | 撳一下 |
| 用戶想帶上文開新 | `fork()`（第二入口，預設唔開） | 明確要求時先用 |

- 分流判斷喺 **runtime 層**（M03）做 → App 唔包含任何 Agent 邏輯。
- session **屬於一個 Workspace**：切 Workspace = 換一組 session。
- session 住 Mac 本地（file-backed SessionManager），跨端經 Relay 見到同一批。

---

## 6. 資料模型（純文字描述，唔係程式碼）

| 集合 | 鍵 | 主要欄位 | 保留期 |
|---|---|---|---|
| transcript（DynamoDB） | partition: user_id；sort: ts#request_id | role、content、kind（text/voice/task/confirm）、audio_url | OQ-4 未決（建議 30 日） |
| task（DynamoDB） | request_id | status（queued/running/awaiting_confirm/completed/failed/partial）、risk_level、started_at、ended_at、result_ref | 同 transcript |
| tts_cache（S3 + DynamoDB 索引） | hash(text+voice) | mp3_url、created_at | 24 小時 |
| session（Mac 本地） | session file | Pi SDK session entries、workspace 關聯、auto 標記 | 保留喺 Mac，唔上雲 |
| audit_log（Mac 本地 + transcript 摘要） | 序號 | tool、risk_level、args_digest、result_digest、ts | Mac 本地 |

> 憑證（外部服務 token、AWS secret）**只存 Mac 本地或 AWS Secrets Manager**，永不進 transcript / log / repo。

---

## 7. 失敗模式與降級

| 失敗點 | 偵測 | 降級行為 |
|---|---|---|
| STT 聽唔清 | device STT 空結果 | 保留輸入 + 提示重錄（唔送空訊息） |
| Agent 離線 | sidecar 心跳斷 | App 顯示離線條；訊息排隊；恢復後補送 |
| Sidecar 崩潰 | supervisor 監測 | ≤ 5 秒自動重啟 + App 提示 + session 由磁碟恢復 |
| Relay 逾時 | HTTP timeout | 保留輸入 + 重試鈕 + `request_id` 唔變 |
| Polly 失敗 | API error | 文字回覆照出 + 「語音暫時播唔到」 |
| Push 失敗 | APNs/FCM error | transcript 仍然有結果，下次打開睇到 |
| 工具拋錯 | 工具例外 | 結構化錯誤回 Agent + 任務卡片轉 failed + 具體訊息 |
| 危險命令 | Risk Gate 黑名單 | 攔截 + 確認卡 + audit log 記錄 |
| AWS 成本臨界 | budget alarm / 單任務預算 | 中止任務 → partial → 通知 |

---

## 8. 關鍵技術選型與待驗證點

| 選型 | 決定 | 待驗證 |
|---|---|---|
| Relay transport | **未定**（SPIKE-001）：AppSync Events（serverless pub/sub、閒置免費）／SQS long-poll（最簡、最穩）／API Gateway WebSocket（最通用但每訊息經 Lambda） | 端到端延遲 p50、每千訊息成本 |
| 認證 | 自製 token + Lambda authorizer，AuthProvider 抽象（將來換 Cognito） | token 遺失 recovery（OQ） |
| 語音 | STT device native（私隱 + 粵語準確）；TTS Polly（支援鎖屏語音通知） | SPIKE-002/003 實測 |
| 推播 | APNs/FCM 直接發（唔經第三方網關） | 憑證管理 + payload 上限 |
| 常駐資源 | **唔用常駐 Fargate**（成本門檻 < $30/月） | 單用戶量級夠唔夠 |

---

## 9. 安全邊界

1. **分層憑證**：App token（用戶）≠ Sidecar 身份（client credentials）≠ 外部服務 token（Mac 本地）。
2. **Risk Gate 唯一入口**：所有工具調用必經 M04；M05 唔准直連執行。
3. **路徑鎖死**：M05 檔案工具限於 Workspace 根目錄；terminal 限於 Workspace（cwd 固定）。
4. **audit log**：每次工具調用留痕（tool / args digest / 風險級別 / 結果 / ts）。
5. **憑證不入版控**：AWS / APNs / FCM 憑證入 Secrets Manager；Mac 本地憑證入 keychain。
6. **單用戶 ≠ 冇認證**：Relay 一律要 token（呢個係將來變產品嘅地基）。
