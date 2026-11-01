# AC — SPIKE-001

- US: SPIKE-001
- 類型: Spike ｜ 階段: 0 架構補證 ｜ 優先級: P0 ｜ Story Point: 3
- 驗收方式: 文件 + 一次真實端到端 demo（錄屏）

## Given-When-Then

- **AC-1**: Given 三個候選 transport（AppSync Events、SQS long-poll、API Gateway WebSocket）When 各自喺同一個環境實測「App 上行一訊息 → Mac sidecar 收到 → 結果回傳」Then 每個方案都有一份實測結果（端到端延遲 p50、每千訊息成本估算、連線保持方式、代碼複雜度）
- **AC-2**: Given 實測結果 When 對比「雙手唔得閒」場景嘅延遲要求（端到端 ≤ 5 秒）Then 有一份明確推薦方案 + 每個落選方案嘅一句理由

## Definition of Done（技術視角）

- [ ] 產出 `docs/spike/relay-transport.md`（含成本試算表）
- [ ] 結論回填到本 US 嘅「變更歷史」

## 業務規則

單用戶量級（≤ 10 訊息/分鐘、≤ 1 常駐連線）；唔引入常駐 Fargate（成本 > $30/月 直接否決）

## 依賴

AWS account、Tauri 2 hello-world

> 對應 Backlog: `docs/backlog.md` ｜ 需求錨點: `docs/req/SPIKE-001-requirement.md`
> 本檔由 dav-planner Step 4 生成（2026-11-01）；之後以本檔為準，唔好重跑生成器覆蓋。
