# SPIKE-001 — AWS relay transport 選型（實測報告）

> 產出：dav-developer 批次 0（2026-11-01）｜對應 backlog: `SPIKE-001`（Module `M02`）｜區域: `ap-southeast-1`
> 量度腳本：`spikes/relay-transport/`（contract 測試 ＋ 實測 CLI ＋ CloudFormation 模板）
> 臨時資源：`voice-agent-spike-relay` stack（量度完已刪）

---

## 1. 結論（推薦）

**採用「方案 A：SQS long-poll」做 M02 relay v1。**

| 理由 | 實測/客觀依據 |
|---|---|
| **延遲最優** | p50 **227ms** / p95 515ms（WS 嘅 4.4 倍快；門檻 ≤ 5 秒，餘裕 20×） |
| **成本近乎零** | idle **$0**；每月 ≈ **$0.03**（含 43,200 次長輪詢 ＋ 每訊息 2 個 request） |
| **複雜度最低** | 2 個 infra 資源（SQS queue + policy）、**0 個 Lambda**、0 個連線登記、adapter 66 行 |
| **維護面最窄** | WS 方案實測撞到 **8 個 setup 陷阱**（§5）；SQS 方案 0 個 |

**取捨同補救**：SQS 唔係真 streaming（要 polling）。但本產品嘅流量係**任務式**（派任務 → 背景執行 → 完成通知），唔需要逐 token streaming → **足夠**。
若日後真要做「Agent 逐段回覆」streaming：升級做 **WS 點對點**（Sidecar 直接用 API Gateway Management API 推去指定 connection，**唔廣播、唔掃 DynamoDB**），而唔係今次呢個廣播模式。

---

## 2. 三方案對照表

| 指標 | **A. SQS long-poll** ✅推薦 | C. API Gateway WebSocket | B. AppSync Events |
|---|---|---|---|
| 實測 p50 | **227 ms** | 993 ms | ⛔ 無法建立（見 §4） |
| 實測 p95 | **515 ms** | 1,058 ms | — |
| 實測 max | 592 ms | 1,063 ms | — |
| 收齊率 | 50/50 | 50/50 | — |
| idle 月費 | **$0**（无常駐資源） | 有常駐連線費（數值需以官方定價頁核實，見 §3 註） | — |
| 每訊息 AWS 成本 | $0.40/1M request × 2 = **$0.0000008/訊息** | $2.00/1M WS message ＋ Lambda ＋ DynamoDB Scan（廣播模式隨連線數線性升） | — |
| infra 資源數 | **2**（queue + policy） | **10**（Api/Integration/3 routes/Deployment/Stage/Lambda/Role/Permission/DynamoDB） | — |
| client adapter LOC | 66 | 55 ＋ Lambda 43 | — |
| 實作陷阱數 | **0** | **8**（§5） | — |
| 權限/憑證風險 | 低（queue policy 收窄即可） | 中（連線登記 ＋ 管理 API） | — |

---

## 3. 成本試算（單用戶、假設 10,000 訊息/月）

> ⚠️ 定價數字來自 AWS 官方定價頁；本次 IAM 帳戶**冇 `pricing:GetProducts` 權限**（AccessDenied），無法自動抓取核實 → 以官方定價頁為準。

| 項目 | SQS long-poll | API Gateway WebSocket |
|---|---|---|
| 長輪詢（20 秒一輪 × 43,200/月） | 43,200 request ≈ **$0.017** | — |
| 訊息送 + 收（2 request/訊息） | 20,000 request ≈ **$0.008** | 20,000 WS message ≈ $0.040 |
| Lambda invocation | **$0** | 10,000 × ≈ $0.20/1M ≈ $0.002 ＋ 執行時間 |
| DynamoDB（廣播要 Scan 全表） | **$0** | 10,000 Scan + writes ≈ $0.001（**隨連線數線性升**） |
| 常駐連線 | **$0** | 有 connection-minute 費（$0.08/連線-分鐘級，數值待核實）→ 2 條連線 ≈ 數美元/月 |
| **每月合共** | **≈ $0.03** | ≈ $0.05 ＋ 常駐連線費 ＋ 維護 Lambda/DynamoDB |

**結論**：SQS 嘅成本低到可以唔使理；WS 嘅真實成本唔在「每訊息」，而在**常駐連線 ＋ Lambda/DynamoDB 維護面**。

---

## 4. 被 block 嘅方案：AppSync Events（方案 B）

| 嘗試 | 結果 |
|---|---|
| CloudFormation `AWS::AppSync::Api` + `EventConfig{ApiType: EVENT}` | ❌ EarlyValidation 失敗；再查 CFN resource schema（`describe-type`）：**呢個 region 嘅 `AWS::AppSync::Api` 根本冇 `EventConfig` 屬性** |
| AWS CLI `appsync create-api --api-type EVENT` | ❌ CLI 版本太舊：**冇 `create-api` 呢個 operation**（只有 GraphQL 系列） |
| AWS CLI `appsync create-graphql-api --api-type EVENT` | ❌ `BadRequestException: Invalid API type specified`（region/帳戶唔支援 EVENT type） |

**意義**（唔止係「做唔到」）：
1. 喺呢個環境要用 AppSync Events，得升 CLI + 確認 region 支援 → **多一個人工 setup 步驟**，對「一個人做嘅產品」係額外摩擦。
2. 就算做到，佢嘅優勢（serverless pub/sub、唔使連線登記）對我哋**任務式流量**嚟講唔關鍵。
3. **記錄在案**：日後如果要做真 streaming 而 SQS 唔夠，先再評估（並記住當時嘅帳戶/region 限制）。

---

## 5. API Gateway WebSocket 實測撞到嘅 8 個陷阱（複雜度證據）

1. **SAM transform 唔支援** `Type: ApiGatewayV2` 嘅 WebSocket event → 要改用純 CloudFormation（自己寫 Integration/Route/Deployment/Stage）。
2. 冇 `AWS::ApiGatewayV2::Stage` → 握手 **403 Forbidden**（routes 有都冇用）。
3. 冇 `AWS::Lambda::Permission`（apigateway.amazonaws.com）→ 握手 **403 Forbidden**。
4. WebSocket URL **要帶明確 stage path**（`wss://<api-id>.execute-api.<region>.amazonaws.com/$default`）；淨係 `...amazonaws.com/` → **403**（呢個最陰險：curl 會「掛住唔回」，睇落似成功）。
5. `AWS::ApiGatewayV2::Deployment` **唔可以 in-place 更新** → 改 route 要換新 logical id（WsDeployment → WsDeploymentV2）。
6. Stage **唔可以同時**設 `AutoDeploy` 同 `DeploymentId` → 更新失敗（UPDATE_FAILED）。
7. 廣播模式每訊息要 **DynamoDB Scan + 逐個 postToConnection** → 延遲 p50 直達 ~1 秒，成本隨連線數線性升。
8. `aws pricing get-products` **AccessDenied**（成本數字要人手核實）。

---

## 6. 實測方法（可重現）

```bash
cd spikes/relay-transport
npm install
npm test                      # contract 測試（先紅後綠）
npx tsc --noEmit              # Gate 2 lint

# 部署臨時 stack（量度完用 sam/aws cloudformation delete 刪）
aws cloudformation deploy --stack-name voice-agent-spike-relay \
  --template-file infra/relay-stack.yaml --capabilities CAPABILITY_IAM --region ap-southeast-1

# 量度
AWS_REGION=ap-southeast-1 npx tsx src/measure.ts --transport=sqs --count=50
AWS_REGION=ap-southeast-1 npx tsx src/measure.ts --transport=ws  --count=50
```

量度口徑：`publish(task)` → 對端收到 → `latency = now - task.sentAt`（**端到端**，包含 AWS 內部處理）。

---

## 7. 對架構嘅影響（已同步落文件）

| 文件 | 更新 |
|---|---|
| `docs/system-design.md` §8 | transport 由「未定」→ **已定：SQS long-poll**；並記低「真 streaming 嘅升級路徑 = WS 點對點」 |
| `docs/system-design.md` §5.1 | 資料流由「transport 待選」改成 SQS long-poll 語義（派任務 → 隊列 → sidecar 長輪詢 → 結果回隊列 → App 取） |
| `docs/prd/02-relay-backend.md` | FR-M02-04 由「待 SPIKE-001 選型」→ **已定案 SQS long-poll** ＋ 新增業務規則（queue 保留期、常駐連線費為零、sidecar 離線時訊息留隊列） |
| `docs/backlog.md` | `SPIKE-001` 狀態 → **等待校驗**；詳細段加「實測結論」 |

## 8. 清理

量度完已刪除臨時 stack（`voice-agent-spike-relay`）→ **冇常駐 AWS 成本**。
（SAM CLI 自動建嘅 artifact bucket `aws-sam-cli-managed-default-samclisourcebucket-*` 仍在，可手動刪。）
