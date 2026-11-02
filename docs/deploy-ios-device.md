# iOS 真機部署指南（Voice Agent 手機版）

> 目標：喺真 iPhone 上行起 App、講嘢入去、Agent 喺你 Mac 做完任務、答案返到手機。
> **目前狀態**：所有代碼已就位並喺 iOS 27.2 simulator 驗證（包括跨機完整鏈路 ＋ STT plugin 編譯/權限/粵語 recognizer）。
> **仲差嘅**：Apple Developer 簽名（要你自己嘅帳戶）＋ 一部實機。

---

## 一、你要準備乜（我幫唔到嘅部分）

| # | 事項 | 點樣做 | 大約時間 |
|---|---|---|---|
| 1 | **Apple Developer Program** | developer.apple.com 訂閱（個人 $99/年）。冇就做唔到真機（simulator 唔需要） | 5 分鐘申請 |
| 2 | **Apple ID 登入 Xcode** | Xcode → Settings → Accounts → ＋ Apple ID → 選你個帳戶 | 2 分鐘 |
| 3 | **建立開發簽名身份** | Xcode → Settings → Accounts → Manage Certificates → ＋ Apple Development | 自動 |
| 4 | **註冊實機 UDID** | Xcode → Window → Devices → ＋ （插線、trust 部 Mac、解鎖） | 2 分鐘 |
| 5 | **Mac 上面行住 sidecar** | `cd runtime/sidecar && npm run build` ＋ 開 relay 環境變數行 `node dist/main.mjs` | 見下 |

> 我幫你準備好嘅：檢查腳本 `scripts/ios-device-setup.sh`、打包指令、開機自檢、權限說明、圖標。

---

## 一之二、呢部 Mac 而家嘅狀態（2026-11-02 實測）

```
✅ Xcode 27.2 ／ iOS SDK 27.2
✅ Xcode 已登入 Apple ID（可用 team：0EEC9D2B46、6YR6P3Y6WP）
❌ 冇 Apple Development 簽名身份     → Xcode → Settings → Accounts → Manage Certificates → ＋ Apple Development
⚠️ 冇插實機                        → 插線 + 部機解鎖 + 撳「信任」
ℹ️ bundle id：com.voiceagent.mobile（要同 Apple Developer portal 一致）
```

即係話：**仲差「建立簽名證書」＋「插部 iPhone」** 兩步。

---

## 二、逐步部署

### 1. 檢查環境（我已經幫你跑過）

```bash
bash scripts/ios-device-setup.sh
# 有 Apple Developer 身份之後，寫入 development team：
bash scripts/ios-device-setup.sh --team <你嘅 Team ID>
```

`developmentTeam` 會寫入 `apps/tauri-mobile/src-tauri/tauri.conf.json`（Xcode → Settings → Accounts 亦見到同一個 Team ID）。

### 2. 打包真機版

```bash
cd apps/tauri-mobile
npx tauri ios build --device          # 產 Voice Agent.ipa + .app
# 或者直接落去接住嘅實機：
npx tauri ios dev --device            # 開發模式（熱重載）
```

第一次 build Xcode 會自動：
- 用你嘅 Team ID 做 code signing
- 產生 provisioning profile（Development 類型，自動對應你註冊嘅裝置）

### 3. 裝去手機

**方法 A（Xcode 直裝）**：build 完打開 `src-tauri/gen/apple/build/iphoneos-*/` 入面嘅 Xcode project → 揀你部 iPhone → ▶ Run

**方法 B（TestFlight／裝 IPA）**：
```bash
cd apps/tauri-mobile/src-tauri/gen/apple/build/iphoneos-*/Payload
# 用 Apple Configurator 或者：
xcrun devicectl device install app --device <UDID> "Voice Agent.app"
```

### 4. 第一次喺手機開

1. 開 App → 會問**麥克風**同**語音辨識**權限 → 兩樣都撳「允許」
   （Info.plist 已經寫明用途：*「辨識喺裝置本機完成，唔會上傳音訊」*）
2. 撳右上 ⚙ → 填：
   - **Relay API URL**：`https://nqh8j1u2a0.execute-api.ap-southeast-1.amazonaws.com`
   - **Token**：你嘅 relay token（喺 Mac：`cat runtime/relay-api/.relay-token`）
   - 撳「儲存並連接」→ 狀態燈變綠（已連接）
3. 撳「按住 說話」講嘢 → 松手 → 文字入面 → 自動送去

> **注意**：token 係敏感嘢，正式發佈應該改用 Cognito 對應嘅登入流程（`AuthProvider` 已經係可插拔嘅，見 `runtime/relay-api/src/authorizer.ts`）。

---

## 三、Mac 上面要行住 sidecar（Pi SDK 喺 Mac，唔喺手機）

手機 **唔會** 直接跑 Agent —— 任務經 AWS relay 去你 Mac 上面嘅 sidecar 執行。

```bash
cd runtime/sidecar
npm run build
source /tmp/sidecar-relay.env      # TASKS_QUEUE_URL / RESULTS_QUEUE_URL / TRANSCRIPT_TABLE / TASK_TABLE / RELAY_USER_ID / AWS_REGION
node dist/main.mjs --workspace=$HOME/agent-workspace
```

睇下有冇行緊：
```bash
tail -f /tmp/sidecar-relay.log
# 應該見到：[relay] worker 已啟動（輪詢 tasks queue）
```

**Sidecar 生命週期**（跟 App/Mac 走）：
- 關咗個 App 或者 Mac 瞓咗 → sidecar 停 → 手機派嘅任務**留喺 SQS 至少 1 個鐘**，返嚟再開就會繼續做
- 同一時間只跑一個任務（Pi SDK 限制）→ 有任務等緊你批核確認卡時，其他任務排隊

---

## 四、真機驗收清單（逐項打勾）

| # | 測試 | 期望 | 狀態 |
|---|---|---|---|
| 1 | 開 App | 見到對話介面（WeChat 式、底部浮動輸入列） | ⬜ |
| 2 | ⚙ 填 API URL + token | 狀態燈變綠「已連接」 | ⬜ |
| 3 | 按住說話講「今日要做咩」 | 松手後文字入面，語音轉文字正確（粵語） | ⬜ |
| 4 | 送出 | Mac sidecar log 見到 `[relay] relay 收到任務 …` | ⬜ |
| 5 | Agent 要調 terminal／寫檔 | **手機彈確認卡**（預覽內容） | ⬜ |
| 6 | 撳「取消」 | Agent 停手，唔會執行 | ⬜ |
| 7 | 撳「確認執行」 | Agent 執行，結果返到手機對話框 | ⬜ |
| 8 | 講「confirm」 | 等同撳確認（只限未過期嘅卡） | ⬜ |
| 9 | 向上捲历史 | 位置唔會跳；右下角出現「⬇ 新訊息」 | ⬜ |
| 10 | 熄屏／鎖屏 | 任務繼續（喺 Mac 執行），完成後推播（**要 APNs 憑證，未有**） | ⬜ |

---

## 五、已知限制（而家未搞掂嘅）

| 限制 | 影響 | 狀態 |
|---|---|---|
| **APNs 推播未接** | 鎖屏時收唔到完成通知（要你嘅 `.p8` key，OQ-10） | ⬜ 未做 |
| **語音回覆（TTS）未接** | Agent 答完係文字，唔會讀出嚟（本地 `AVSpeechSynthesizer` 可以快速加） | ⬜ 未做 |
| **Token 硬喺 App 度** | 適合單用戶 MVP；正式版要換 Cognito 登入 | 🟡 MVP 版 |
| **Android 版未做** | 只得 iOS（Android SDK 未裝） | ⬜ 未做 |
| **實機 STT 準確率未測** | Simulator 嘅 speech recognizer 起唔到（Apple 限制），要真機先知粵語準確率 | ⬜ 待真機 |

---

## 相關文件

- `docs/system-design.md` §3 — 跨機架構（Pi SDK 喺 Mac ＋ relay）
- `docs/prd/01-client-app.md` — 手機端需求
- `docs/prd/02-relay-backend.md` — relay 契約
- `docs/spike/mobile-stt.md` — 粵語 STT 可行性 spike
- `plugins/tauri-plugin-ios-stt/` — STT plugin 原始碼
