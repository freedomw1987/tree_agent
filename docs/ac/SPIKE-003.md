# AC — SPIKE-003

- US: SPIKE-003
- 類型: Spike ｜ 階段: 0 架構補證 ｜ 優先級: P0 ｜ Story Point: 3
- 驗收方式: 真機收到 push + 鎖屏語音播放錄屏

## Given-When-Then

- **AC-1**: Given Tauri 2 mobile app When 註冊 APNs（iOS）/ FCM（Android）device token 並實作一次遠端 push Then 三端（iOS/Android/macOS）都收得到 push
- **AC-2**: Given 一段 Polly 生成嘅 mp3（< 500KB）When 當作 push 附件送出（iOS notification service extension 拉取）Then 鎖屏狀態可以播放語音通知
- **AC-3**: Given APNs payload 大小限制 When 試唔同長度 mp3 Then 記錄可用上限 + 降級方案（長音頻改用 URL 拉取）

## Definition of Done（技術視角）

- [ ] 產出 `docs/spike/mobile-push.md`
- [ ] 確認 signing / 憑證管理流程（憑證唔可以入 repo）

## 業務規則

推播 payload 只准包含任務摘要，唔准塞完整 transcript

## 依賴

Apple Developer / Firebase 帳號、AWS Polly

> 對應 Backlog: `docs/backlog.md` ｜ 需求錨點: `docs/req/SPIKE-003-requirement.md`
> 本檔由 dav-planner Step 4 生成（2026-11-01）；之後以本檔為準，唔好重跑生成器覆蓋。
