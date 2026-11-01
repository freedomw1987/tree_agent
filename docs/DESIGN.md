# DESIGN.md — Voice Agent App（手機 + macOS）

> 產出：dav-designer Step 2（2026-11-01）｜對應 backlog：`docs/backlog.md`
> 術語一律用 `docs/glossary_list.md`（Relay / Risk Gate / Sidecar / Transcript / STT / TTS / Workspace …）

---

## 1. 設計原則

| # | 原則 | 落地後果 |
|---|---|---|
| 1 | **單手可操作** | 主要動作全部落喺屏幕下半部（拇指區）；錄音鍵固定右下 |
| 2 | **語音優先、文字係後備** | 錄音鍵係主 CTA（最大、最顯眼）；文字輸入列次要 |
| 3 | **確認要輕** | 高風險操作只有「確認／取消」兩粒掣；語音講「confirm」等效 |
| 4 | **狀態要誠實** | 永遠顯示 Agent 現況（就緒／做緊／離線／要確認），唔會「靜靜地失敗」 |
| 5 | **零學習成本** | 介面 = WeChat 式對話；所有新概念（Risk Gate、Workspace）只喺桌面版出現 |

---

## 2. 畫面樹

### 2.1 `mobile-app`（iOS / Android，390×844 框）

```
mobile-app
├── /m/chat          對話主畫面（訊息串 + 輸入列 + 錄音鍵 + 確認卡 + 任務卡片）
│   ├── 狀態：錄音中（waveform + 計時）
│   ├── 狀態：STT 結果可編輯（送出事實）
│   ├── 狀態：待確認（確認卡）
│   └── 抽屜：對話 session（Header chip → Sheet：切換 / 開新對話）
├── /m/stats         每日任務數（今日任務數 + 節省輸入時間 + 任務明細）
└── /m/settings      設定（登入 token、語音輸入開關、語音回覆開關、安靜模式、推播權限狀態）
```

### 2.2 `desktop-mac`（macOS，桌面寬版）

```
desktop-mac
├── /d/chat          對話（寬版；左欄 session 清單 + 右欄訊息串 + 輸入列）
├── /d/runtime       Agent 狀態（就緒／離線）、Workspace 選擇、Session 管理、重啟 sidecar
├── /d/tools         工具 audit log（工具 / 參數摘要 / 風險級別 / 結果 / 時間）+ Risk Gate 規則總覽
└── /d/stats         每日任務數（大屏版：走勢 + 明細）
```

### 2.3 `cli-terminal`（Mac sidecar console，假終端）

```
cli-terminal
└── /t/console       sidecar stdout/stderr 風格 view
    ├── streaming 輸出（Agent 回覆逐段）
    ├── relay 送達 log（App → Relay → Sidecar）
    ├── 工具調用 log（含被 Risk Gate 攔截嘅操作）
    └── session / token / workspace 啟動摘要
```

---

## 3. 互動流程

### 3.1 語音任務流（主流程 · step-1 → step-4）

1. 用戶按住右下錄音鍵講嘢 → 放開
2. device native STT 轉文字 → **顯示可編輯文字**（唔自動送出）
3. 用戶確認／直接改 → 送出 → 訊息右邊氣泡，狀態「已送出」
4. Relay 收到 → ack → 氣泡變「已送達」
5. Sidecar 執行（cli-terminal 見 streaming）
6. 完成 → 推送通知（＋Polly 語音）＋ 對話串插入任務卡片
7. 用戶撳卡片 → 睇交付物全文；撳「播報」→ TTS mp3 播放

### 3.2 高風險確認流（step-5 → step-6）

1. Agent 欲執行 `write` / `external_effect` 工具 → Risk Gate 攔截
2. App 插入**確認卡**：標題、完整預覽（diff / payload）、風險級別徽章、5 分鐘倒數
3. 用戶可撳「確認／取消」，或**講「confirm」**（語音 → STT → 文字 → 視同撳確認）
4. 確認 → 工具執行 → audit log 記錄 → 任務卡片顯示完成
5. 取消 / 5 分鐘過期 → 操作取消，transcript 記低（唔會自動重試）

### 3.3 離線／失敗流（Edge state）

- Agent 離線 → 輸入列上方出現琥珀色條「Agent 離線，訊息會排隊」；訊息可送出 → 排隊狀態
- 任務失敗 → 任務卡片轉紅 + 具體錯誤（講點樣修正）+ 「重試」／「睇詳情」
- 網絡斷 → 頂部紅條「連唔到 Relay」+ 已輸入內容保留 + 重試鈕

### 3.4 每日統計流（step-8）

`/m/stats` 顯示今日完成任務數（核心指標）+ 節省輸入時間估算 + 任務明細（按時間倒序）+ 空狀態引導「用講嘅方式派第一個任務」。

### 3.5 對話 session 策略（step-9）

| 規則 | 內容 |
|---|---|
| **自動分流（預設）** | Agent 判斷新訊息屬於邊個 session：同一話題 → 續返原本 session；新話題 → 開新 session 並**自動命名**（如「客戶跟進」「本週交付摘要」） |
| **開新對話按鈕** | 手機 Header 有對話 chip（顯示當前 session 標題）→ 抽屜 Sheet → 「開新對話」；桌面版左欄 session 清單可直接切換 |
| **跨 session 標記** | 喺當前 session 睇到其他 session 嘅訊息 → 訊息上方標明所屬對話（唔會混亂） |
| **fork（第二入口）** | 「帶住舊上文開新」用 Pi SDK `fork()`；預設唔開，避免 session 樹失控 |
| **session 屬於 Workspace** | 切 Workspace = 換一組 session（唔會跨專案污染 context） |
| **session 住 Mac 本地** | 唔上雲；手機／桌面經 Relay 見到同一批 session |

> 設計取捨：手機端唔設「逐次揀 session」嘅步驟（雙手唔得閒時每多一步都係摩擦）；session 管理交俾 Agent，用戶只保留「想新開」呢一個手動入口。

---

## 4. Design Tokens（唯一來源：`prototype/voice-agent/src/index.css`）

### 4.1 色

| Token | 值 | 用途 |
|---|---|---|
| `--background` | `#FBFBFD` | App 底色 |
| `--foreground` | `#16181D` | 主文字 |
| `--card` | `#FFFFFF` | 卡片 / 對話背景 |
| `--muted` | `#F2F3F6` | 次要區塊底 |
| `--muted-foreground` | `#6B7280` | 次要文字 |
| `--primary` | `#2F6BFF` | 主 CTA（錄音鍵、發送、確認） |
| `--primary-foreground` | `#FFFFFF` | 主 CTA 文字 |
| `--accent` | `#14B87A` | 成功 / 完成 |
| `--warning` | `#F5A524` | 離線 / 待確認倒數 |
| `--destructive` | `#E5484D` | 失敗 / 取消 / 危險命令 |
| `--border` | `#E4E6EB` | 邊框 / 分隔 |
| `--ring` | `#2F6BFF` | focus ring |
| `--user-bubble` | `#2F6BFF` | 用戶訊息氣泡底 |
| `--agent-bubble` | `#FFFFFF` | Agent 訊息氣泡底 |

### 4.2 字

| Token | 值 |
|---|---|
| `--font-sans` | `-apple-system, "SF Pro Text", "PingFang HK", "Noto Sans TC", sans-serif` |
| `--font-mono` | `"SF Mono", "JetBrains Mono", Menlo, monospace` |
| 字級 | 12 / 14 / 16 / 20 / 24 / 30 px |
| 行高 | body 1.5，標題 1.2，氣泡 1.45 |
| 字重 | 400 正文、500 標籤、600 卡片標題、700 大標 |

### 4.3 間距 / 圓角 / 陰影 / 動效

| Token | 值 | 用途 |
|---|---|---|
| 間距 | 4 / 8 / 12 / 16 / 24 / 32 / 48 | Tailwind 預設刻度 |
| `--radius` | `12px` | 卡片 / 輸入列 |
| `--radius-lg` | `16px` | 任務卡片 / 對話面板 |
| `--radius-sm` | `10px` | 按鈕 / badge |
| `--radius-full` | `999px` | 錄音鍵 / 氣泡 / badge |
| `--shadow-card` | `0 1px 2px rgba(16,24,40,.06), 0 8px 24px rgba(16,24,40,.06)` | 卡片 |
| `--shadow-pop` | `0 12px 40px rgba(16,24,40,.16)` | Sheet / Dialog / 確認卡浮層 |
| 動效 | `150ms cubic-bezier(.2,.8,.2,1)` | 過渡；`prefers-reduced-motion` 時降到 0ms |

---

## 5. 元件庫

### 5.1 shadcn/ui（Radix primitives）

`button` `card` `input` `textarea` `badge` `tabs` `sheet` `dialog` `scroll-area` `switch` `separator` `skeleton` `alert` `progress` `tooltip` `avatar` `dropdown-menu`

### 5.2 自建元件（design-system 層）

| 元件 | 說明 | 用喺 |
|---|---|---|
| `PhoneFrame` | 390×844 手機框（狀態欄 / home indicator） | mobile-app |
| `DesktopShell` | 桌面 shell（sidebar + topbar + content） | desktop-mac |
| `TerminalShell` | 假終端（等寬字 + prompt 行 + 滾動輸出） | cli-terminal |
| `MessageBubble` | 訊息氣泡（user 右 / agent 左 + 狀態點 + 時間戳） | mobile / desktop |
| `VoiceRecorder` | 錄音鍵 + waveform + 計時 | mobile / desktop |
| `SttDraft` | STT 可編輯文字 + 「聽唔清」提示 | mobile / desktop |
| `TaskCard` | 任務卡片（狀態 / 耗時 / 交付物 / 播報 / 重試） | mobile / desktop |
| `ConfirmCard` | 確認卡（預覽 / 風險徽章 / 倒數 / 確認 / 取消） | mobile / desktop |
| `RiskBadge` | 風險級別徽章（read_only 綠 / write 琥珀 / external_effect 紅） | 全部 surface |
| `AgentStatusPill` | Agent 狀態（就緒 / 做緊 / 離線 / 要確認） | mobile / desktop |
| `SessionSheet` | 對話 session 抽屜（列表、切換、開新對話） | mobile / desktop |
| `StatCard` | 統計卡（今日任務數 / 節省時間） | mobile / desktop |
| `StateSwitcher` | 五狀態模擬切換（Demo 用，掛喺 demo 面板） | 全部 surface |

---

## 6. 每 Surface Shell 規格

### 6.1 `mobile-app`
- **框**：390×844，圓角 40px，狀態欄（時間 / 訊號 / 電量）＋ home indicator
- **Header**（56px）：左＝App 名 + `AgentStatusPill`；右＝設定 icon
- **Content**：訊息串（單欄，由下往上），sticky 底部輸入列
- **輸入列**：左＝文字輸入框（可摺疊成一行）；右＝錄音鍵（56px 圓形，`--primary`）；錄音中變紅 + waveform
- **浮層**：確認卡以 Sheet 由下滑入（`--shadow-pop`）；任務卡片直接插入訊息串
- **底部導航**：只有「對話 / 統計 / 設定」三個 tab（圖標 + 文字）

### 6.2 `desktop-mac`
- **Layout**：左 sidebar 240px（對話 / Agent / 工具 / 統計）+ 主區 topbar 52px + content
- **對話頁**：左欄 session 清單（可切換）＋右欄訊息串（最大寬 760px 置中）＋底部輸入列
- **Agent 頁**：狀態卡（大）、Workspace 選擇（路徑 + 選擇鈕）、Session 表（開關 / 重啟 / 保留期限）
- **工具頁**：audit log 表格（工具 / 風險 / 摘要 / 結果 / 時間）＋ Risk Gate 規則表
- **統計頁**：StatCard 行 + 任務明細表

### 6.3 `cli-terminal`
- **框**：全黑底 `#0B0D12`，`--font-mono` 14px，行高 1.5
- **prompt 行**：`agent-workspace %` 綠色 prompt
- **輸出類型**：streaming（逐段追加）、relay 送達（青色 `[relay]`）、工具調用（黃 `[tool]`）、風險攔截（紅 `[blocked]`）、錯誤（紅 `[error]`）
- **無滑鼠依賴**：主要資訊靠前 100 行可讀

---

## 7. 畫面地圖（route → Module → Surface）

| Route | 畫面 | Module | Surface | Demo 步驟 |
|---|---|---|---|---|
| `/` | Surface 選擇 + demo 路線面板 | — | 全 | — |
| `/m/chat` | 對話（訊息／錄音／STT／任務卡／確認卡／session 抽屜） | M01, M03, M04, M05 | mobile-app | step-1, step-4, step-5, step-9 |
| `/m/stats` | 每日任務數 | M01, M02 | mobile-app | step-8 |
| `/m/settings` | 設定（登入／語音／通知） | M01, M02 | mobile-app | — |
| `/d/chat` | 對話（寬版） | M01, M04 | desktop-mac | — |
| `/d/runtime` | Agent 狀態 / Workspace / Session | M03 | desktop-mac | step-3 |
| `/d/tools` | audit log + Risk Gate 規則 | M04, M05 | desktop-mac | step-7 |
| `/d/stats` | 每日統計（大屏） | M01, M02 | desktop-mac | — |
| `/t/console` | sidecar console | M02, M03, M04, M05 | cli-terminal | step-2, step-6 |

---

## 8. DoD-Full 五狀態對照（每 Module × 每 Surface）

| Module | Surface | Happy | Loading | Empty | Error | Edge |
|---|---|---|---|---|---|---|
| M01 client-app | mobile-app | 送出訊息→任務卡 | 錄音中 waveform / 訊息「傳送中」 | 未傾過偈（引導：按住講嘢）／session 抽屜零對話 | Agent 離線 / 網絡斷 | 錄音超 60 秒 / STT 空結果 / 超長訊息 |
| M01 client-app | desktop-mac | 寬版對話 | session 載入 skeleton | 未開 session | sidecar 崩潰提示 | 極長訊息 / 同時多 session |
| M02 relay-backend | cli-terminal | 送達 log | pending 佇列 | 無送達紀錄 | token 失效 401 / relay 逾時 | request_id 重送（冪等） |
| M03 mac-runtime | desktop-mac | Agent 就緒 + session 表 | sidecar 啟動中 | 未選 Workspace | sidecar 崩潰 + 自動重啟提示 | session 檔損毀 / workspace 路徑不存在 |
| M03 mac-runtime | mobile-app | 對話 session 抽屜（切換 / 開新對話） | 載入 session 清單 | 零對話（引導：講第一句就自動開） | session 讀取失敗 | 同一 session 被開兩次 / 跨 session 訊息標記 |
| M04 tool-governance | mobile-app | 確認卡 → 執行 | 等待確認（倒數） | 冇待確認操作 | 取消 / 過期 | 語音 confirm / 連續兩張卡 |
| M04 tool-governance | cli-terminal | 工具調用 log | 工具執行中 | 未調用過工具 | 工具拋錯 | 被 Risk Gate 攔截（危險命令） |
| M05 tool-catalog | desktop-mac | audit log 有紀錄 | 工具執行中 | 工具未註冊 | 憑證失效 / 檔案不存在 | `rm -rf` 攔截 / 60 秒超時 / 200 行截斷 |

---

## 9. 平台差異（RWD + 平台約定）

| 項目 | iOS | Android | macOS |
|---|---|---|---|
| 錄音權限 | 首次錄音彈系統授權 | 首次錄音彈系統授權 | 系統設定 → 麥克風 |
| 通知 | APNs（需 device token + 憑證） | FCM（需 `google-services.json`） | 系統通知中心 |
| 語音通知（鎖屏） | 支援（notification service extension 拉 mp3） | 支援（FCM 附件） | 支援（內置語音播報） |
| 錄音中斷 | 來電 / 路線切換 | 來電 / 分屏 | 螢幕鎖定 |
| 佈局 | 安全區 inset 上下 | 手勢條 inset | 視窗可調整，最小 960×640 |
| 鍵盤 | 系統鍵盤 | 系統鍵盤 | 系統鍵盤 + `⌘K` 快速輸入 |

> 原型 app（demo）以 `mobile-app` / `desktop-mac` / `cli-terminal` 三個外壳呈現；真實平台差異由 `M01` 實作時對齊 `TECH-401`（native plugin 層）。
