# SPIKE-001 需求錨點

> US: SPIKE-001 | 建立: 2026-11-01 | 來源: 對話摘要（dav-planner Step 1-3 需求訪談）

## 用戶原話（唯讀）

- R1: 「2. 他會連住AWS 上一個lambda + pi sdk 去做agent runtime (但中間您可能要幫我想想架構是怎樣)。」
- R2: 「Agent 跑喺你部 Mac，AWS 做中轉（推薦）」

## 澄清後驗收句

- R1: 架構要由 Agent 建議（AWS + pi SDK），唔係用戶已定死嘅實作細節。
- R2: Agent 跑喺 Mac、AWS 做中轉 —— 方向已定，但中轉層用咩技術未驗證。

## 變更歷史

| 日期 | 變更 | 原因 |
|------|------|------|
| 2026-11-01 | 建立（來源：dav-planner 需求訪談） | 首次澄清 |
| 2026-11-01 | 實測結論回填 | 推薦方案 A（SQS long-poll）：實測 p50 227ms / p95 515ms（WS 嘅 993ms ÷ 4.4）、idle $0、每月 ≈ $0.03、只需 2 個 infra 資源、0 個 Lambda、0 個 setup… |
