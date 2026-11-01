# AC — SPIKE-002

- US: SPIKE-002
- 類型: Spike ｜ 階段: 0 架構補證 ｜ 優先級: P0 ｜ Story Point: 3
- 驗收方式: 真機測試數據 + 可運行嘅 plugin 骨架

## Given-When-Then

- **AC-1**: Given iOS Speech framework（zh-HK）同 Android SpeechRecognizer（粵語 locale）When 喺真機用同一批樣本（粵語、中英夾雜、背景噪音，各 ≥ 20 句）測試 Then 有 WER／可用率數據同樣本清單
- **AC-2**: Given Tauri 2 mobile plugin 介面 When 實作一個最薄嘅「錄音 → 轉文字 → 回傳 Rust」plugin Then iOS 同 Android 都跑通（權限申請、來電中斷、藍牙耳機斷線都測過）

## Definition of Done（技術視角）

- [ ] 產出 `docs/spike/mobile-stt.md`（含數據 + plugin 骨架 code）
- [ ] 結論決定 US-102 係 native 定需要雲端 fallback

## 實測結論

iOS 部分實測完成：粵語 STT 可用（SFSpeechRecognizer locale `zh-HK` → available；`yue-Hant-HK` 唔支援）；Tauri 2 iOS 工具鏈行得通（tauri ios init 生成 Xcode project ＋ cargo build --target aarch64-apple-ios-sim 1m39s 成功）。未裝 iOS simulator runtime（要 xcodebuild -downloadPlatform iOS）、真機要簽名、Android 完全 blocked（本機無 SDK 無真機）→ 粵語 WER/準確率未驗證。詳見 docs/spike/mobile-stt.md

## 業務規則

語言預設 zh-HK（粵語）；STT 結果一定要可編輯，唔可以自動送出

## 依賴

iOS + Android 真機、Tauri 2 mobile 工具鏈

> 對應 Backlog: `docs/backlog.md` ｜ 需求錨點: `docs/req/SPIKE-002-requirement.md`
> 本檔由 dav-planner Step 4 生成（2026-11-01）；之後以本檔為準，唔好重跑生成器覆蓋。
