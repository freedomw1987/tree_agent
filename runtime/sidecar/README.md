# M03 — Mac sidecar（Pi SDK runtime host）

> 批次 1 嘅執行產出。Node/TS sidecar：宿主 Pi SDK session、對話分流、IPC 協、崩潰自動重啟。

## 點跑

```bash
npm install
npm test                       # 15 條探針（session host / IPC 協議 / supervisor）
npx tsc --noEmit               # Gate 2 lint

# 手動行（stdio JSON lines IPC）
npm start -- --workspace ~/agent-workspace
```

## IPC 協議（stdio JSON lines，一行一個 JSON）

| 方向 | 訊息 | 用途 |
|---|---|---|
| Rust → Node | `{"type":"prompt","id":"r1","text":"…"}` | 派任務 |
| Rust → Node | `{"type":"status"}` | 查狀態 |
| Rust → Node | `{"type":"fork","id":"r2"}` | 帶上文開新對話 |
| Rust → Node | `{"type":"switch_session","sessionId":"…"}` | 切換對話 |
| Rust → Node | `{"type":"shutdown"}` | 收工（跟 App 生死） |
| Node → Rust | `{"type":"ready","sessionId":"…","sessionTitle":"…","workspace":"…"}` | 就緒／改名 |
| Node → Rust | `{"type":"chunk","text":"…"}` | streaming 增量 |
| Node → Rust | `{"type":"done","id":"r1","text":"…"}` | 完成 |
| Node → Rust | `{"type":"error","message":"…"}` | 錯誤（講得出點解錯） |

壞行唔會炸 host：parse 失敗 → 回 `error` ＋ 繼續行。

## 對話 session 策略（OQ-5 + FR-M03-08）

- **自動分流**：命中話題規則（客戶／交付／會議／帳務）→ 續嗰條 session；冇命中 → 續當前。
- **自動命名**：首次命中規則時改 session 標題（例如「客戶跟進」），並發 `ready` 通知 client 更新 UI。
- **fork**：第二入口（帶住舊上文開新），原 session 唔受影響。
- **跟 App 生死**：App 閂咗 / Mac 瞓咗 → `dispose()`（session 檔保留喺 Mac 本地，唔留孤兒 process）；期間派落嘅任務留喺 SQS 隊列（M02），返嚟補做。

## 實測確認

- 真 Pi SDK 可以喺本機開 session（`sessionFile` → `~/.pi/agent/sessions/<encoded-cwd>/*.jsonl`），model = `MiniMax-M3.1-Flash`；開 session 唔使調模型（唔費錢）。
- `SessionManager.list()` 係 **async**（SDK 1.4.0）—— 寫 adapter 時要 `await`。
- `getLastAssistantText()` 可能回 `undefined` —— 要當住可選。
