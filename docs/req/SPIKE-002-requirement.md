# SPIKE-002 需求錨點

> US: SPIKE-002 | 建立: 2026-11-01 | 來源: 對話摘要（dav-planner Step 1-3 需求訪談）

## 用戶原話（唯讀）

- R1: 「1. 我想有一個手機APP，他會好像Wechat 一樣，他可以錄我的語音訊息，也可以讓我輸入文字內容(如果Agent 能回覆我語言訊息更皆)。」
- R2: 「option1， TTS 是用aws polly」

## 澄清後驗收句

- R1: 語音輸入係第一優先嘅輸入方式。
- R2: STT 選 device native、唔上傳音頻；TTS 用 AWS Polly。

## 變更歷史

| 日期 | 變更 | 原因 |
|------|------|------|
| 2026-11-01 | 建立（來源：dav-planner 需求訪談） | 首次澄清 |
| 2026-11-01 | 實測結論回填 | iOS 部分實測完成：粵語 STT 可用（SFSpeechRecognizer locale `zh-HK` → available；`yue-Hant-HK` 唔支援）；Tauri 2 iOS 工具鏈行得通（tauri ios init … |
