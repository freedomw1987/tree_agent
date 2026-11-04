# M00-US-105 需求錨點

> US: M00-US-105 | 建立: 2026-11-01 | 來源: 對話摘要（dav-planner Step 1-3 需求訪談）

## 用戶原話（唯讀）

- R1: 「1. 我想有一個手機APP，他會好像Wechat 一樣，他可以錄我的語音訊息，也可以讓我輸入文字內容(如果Agent 能回覆我語言訊息更皆)。」
- R2: 「option1， TTS 是用aws polly」

## 澄清後驗收句

- R1: Agent 回覆語音訊息會更好。
- R2: TTS 用 AWS Polly。

## 變更歷史

| 日期 | 變更 | 原因 |
|------|------|------|
| 2026-11-01 | 建立（來源：dav-planner 需求訪談） | 首次澄清 |
| 2026-11-01 | 實測結論回填 | **本地 TTS 已完成**（plugins/tauri-plugin-ios-tts/）：AVSpeechSynthesizer，粵語 voice 優先（yue-HK → zh-HK → zh-TW → en-US），音訊階段 .play… |
