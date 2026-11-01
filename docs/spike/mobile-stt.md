# SPIKE-002 — Mobile device-native STT 可行性

> 產出：dav-developer 批次 0（2026-11-01）｜對應 backlog: `SPIKE-002`（Module `M01`）
> 狀態：**iOS ✅ 可行（實測）／Android ⛔ 環境缺失**

---

## 1. 結論

| 項目 | 結論 | 證據 |
|---|---|---|
| **iOS 粵語 STT** | ✅ **可用** | `SFSpeechRecognizer(locale: "zh-HK")` → `available`（⚠️ `yue-Hant-HK` **唔支援**，要用 `zh-HK`） |
| **Tauri 2 iOS 工具鏈** | ✅ **行得通** | `tauri ios init` 成功生成 Xcode project；`cargo build --target aarch64-apple-ios-sim` **1m39s 成功**（產出 `.a` + `.dylib`） |
| **iOS 模擬器 runtime** | ⛔ **未裝** | `xcodebuild -downloadPlatform iOS` 可補（GB 級下載）；未裝時 `tauri ios build` 報 `iOS platform not installed` |
| **iOS 真機 build** | ⛔ 需簽名 | 要 Apple Developer 帳戶（OQ-7 / OQ-10） |
| **Android** | ⛔ **完全 blocked** | 本機無 Android SDK（`ANDROID_HOME` 空）、無真機 → 粵語 STT、push、release build 全部未驗證 |

---

## 2. 實測步驟（全部喺本機跑過）

```bash
# ① iOS 粵語 locale 支援（Swift 一段即得）
SFSpeechRecognizer(locale: Locale(identifier: "zh-HK"))  → available
SFSpeechRecognizer(locale: Locale(identifier: "yue-Hant-HK")) → nil（唔支援）

# ② Tauri 2 iOS 專案生成
npm create tauri-app@latest tauri-mobile-check -- --template vanilla-ts --manager npm --yes
cd tauri-mobile-check && npm i && npm i -D @tauri-apps/cli@^2
npx tauri ios init
# → Created project at src-tauri/gen/apple/tauri-mobile-check.xcodeproj
#   （自動裝 CocoaPods 1.17 + Ruby 4.0.9）

# ③ Rust → iOS 交叉編譯（關鍵驗證）
rustup default stable && rustup target add aarch64-apple-ios aarch64-apple-ios-sim
cd src-tauri && cargo build --target aarch64-apple-ios-sim
# → Finished `dev` profile in 1m39s
# → target/aarch64-apple-ios-sim/debug/libtauri_mobile_check_lib.{a,dylib}
```

## 3. 撞到嘅 4 個坑（實作要寫入 README / 環境說明）

1. **Homebrew 嘅 rust 唔支援 iOS 交叉編譯** → 必須用 **rustup toolchain**，且 `PATH` 要 `~/.cargo/bin` 優先（`/opt/homebrew/bin/rustc` 會蓋過 rustup shim）。
2. **唔可以直接用 `xcodebuild` build** → Tauri 2 要求由 `tauri ios build` 驅動（佢要起 `cli-options-server.json`），直接 build 會報 `failed to read ... cli-options-server.json`。
3. **iOS simulator runtime 未裝** → `tauri ios build` 報 `iOS platform not installed`；`xcodebuild -showsdks` 有 SDK（27.2）但**冇 runtime**（runtime 先係跑 app／打包要用嗰個）。
4. **`tauri ios init` 會自動改系統**（brew 裝 cocoapods + 升 ruby）→ 呢個係一次過成本，但要事先知。

## 4. 對 M01 / TECH-401 嘅實作指引（已同步入 PRD）

- **iOS plugin**：`SFSpeechRecognizer`（locale `zh-HK`）＋ `AVAudioEngine` 收 PCM → `SFSpeechAudioBufferRecognitionRequest`；權限 key：`NSSpeechRecognitionUsageDescription`、`NSMicrophoneUsageDescription`。
- **Rust 側 trait**：`stt_start` / `stt_stop` / `stt_result`（平台細節唔漏到 UI 層）。
- **Android plugin**：同一個 trait 介面，用 `RecognizerIntent`（locale `yue-HK` 待真機驗證）＋ `SpeechRecognizer`。
- **本地 TTS**：`AVSpeechSynthesizer`（iOS/macOS）＋ Android `TextToSpeech`（粵語 voice 可用性待真機驗證）。

## 5. 需要用戶補嘅嘢（去咗先可以完成呢個 spike）

| 需要 | 影響 |
|---|---|
| 下載 iOS simulator runtime（`xcodebuild -downloadPlatform iOS`，或 Xcode → Settings → Platforms） | 跑得起 iOS 模擬器、驗證 STT 真實準確率 |
| 一部 Android 機 ＋ Android Studio/SDK | Android STT 粵語準確率、push 實測 |
| Apple Developer 帳戶（OQ-7 / OQ-10） | 真機 build ＋ APNs ＋ 發佈路徑 |
| 一部 iPhone（iOS 17+） | 粵語 STT 真實準確率（背景噪音、來電中斷、藍牙耳機） |

**未做嘅實測**（誠實記低，唔當已驗證）：粵語 STT **準確率/WER**（需真機 ＋ 粵語樣本 ≥ 20 句）、噪音下表現、來電中斷、藍牙斷線、Android 側全部。
