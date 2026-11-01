# M00-US-103 需求錨點

> US: M00-US-103 | 建立: 2026-11-01 | 來源: 對話摘要（dav-planner Step 1-3 需求訪談）

## 用戶原話（唯讀）

- R1: 「2. 他會連住AWS 上一個lambda + pi sdk 去做agent runtime (但中間您可能要幫我想想架構是怎樣)。」
- R2: 「Agent 跑喺你部 Mac，AWS 做中轉（推薦）」
- R3: 「自動分流 ＋ 開新對話按鈕（推薦）」

## 澄清後驗收句

- R1: agent runtime 用 pi SDK。
- R2: 真正跑 pi SDK 嘅地方係 Mac；AWS 只做中轉。
- R3: session 策略喺 runtime 層：Agent 自動判斷續／開新 ＋ 自動命名。

## 變更歷史

| 日期 | 變更 | 原因 |
|------|------|------|
| 2026-11-01 | 建立（來源：dav-planner 需求訪談） | 首次澄清 |
| 2026-11-01 | 實測結論回填 | 批次 1 完成 ＋ macOS 殼接通：Node sidecar（session host／對話自動分流＋自動命名／stdio JSON lines IPC／崩潰自動重啟 ≤5 秒／單任務預算上限／真 Pi SDK 接線）＋ apps/ta… |
