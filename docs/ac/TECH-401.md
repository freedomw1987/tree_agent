# AC — TECH-401

- US: TECH-401
- 類型: TECH ｜ 階段: 技術債 ｜ 優先級: P1 ｜ Story Point: 8
- 驗收方式: 跑 `REGRESSION_MODULE=M00 ./run_pipeline.sh TECH-401`

## Given-When-Then

- **AC-1**: Given Tauri mobile 冇官方語音 / 推播 plugin When 實作自建 plugin 層（Swift + Kotlin）Then 提供統一 Rust trait 介面（stt / tts / push）畀 UI 層呼叫

## Definition of Done（技術視角）

- [ ] 探針 `TECH-401-plugin-interface-stable` 必通過
- [ ] Rust trait 介面變更時唔使改 UI 層（介面穩定性測試）

## 實測結論

第一個自建 plugin 已完成並跑通（plugins/tauri-plugin-ios-stt/）：Rust crate ＋ Swift package（ios/Package.swift ＋ .tauri/tauri-api）＋ build.rs `.ios_path("ios")`（自動 copy Tauri Swift API ＋ 編譯 Swift ＋ link）＋ `tauri::ios_plugin_binding!` FFI。**未做**：local TTS plugin、push plugin（要你嘅憑證）、Android 對應 plugin

## 業務規則

平台細節（Swift / Kotlin）唔准漏到 UI 層；憑證管理喺 plugin 層統一處理

## 依賴

SPIKE-002、SPIKE-003

> 對應 Backlog: `docs/backlog.md` ｜ 需求錨點: `docs/req/TECH-401-requirement.md`
> 本檔由 dav-planner Step 4 生成（2026-11-01）；之後以本檔為準，唔好重跑生成器覆蓋。
