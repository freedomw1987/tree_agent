# M02 — Relay API（App 唔使直接攞 AWS 憑證）

> HTTP API ＋ 成本守衛。App 只需要 `Authorization: Bearer <token>`。

## 路由

| 方法 | 路徑 | Body / Query | 回應 |
|---|---|---|---|
| POST | `/tasks` | `{ text, requestId?, kind?, title? }` | `202 { requestId, status:"queued" }` |
| GET | `/transcript` | `?cursor=&limit=` | `200 { entries, cursor }` |

**錯誤訊息要可執行**：400 會講明要點改（例如 `缺少 text（要講咩任務）—— 例：{ text: '幫我寫封 email' }`）、413 會講上限、401 會講要點傳 token。

## 認證：點解**唔**用 API Gateway REQUEST authorizer

實測踩坑記錄（重要，唔好「優化返」）：
- REQUEST authorizer 有被 invoke、response 內容正確（`{isAuthorized:true, context:{...}}`），但 API Gateway 喺 **authorizer 之後、integration 之前**回 `500 Internal Server Error`，而 **API Lambda 一次都唔會被 invoke**。
- 試過：單一 vs 多個 `IdentitySource`、`AuthorizerPayloadFormatVersion: 2.0`、deny 唔帶 `statusCode`、context 加 `stringToValue` —— 全部一樣 500。
- 最終做法：**喺 API Lambda 內驗 token**（用同一個純函式 `authorize()`，有單元測試）→ 401/202 全部正常，零成本差（單用戶量級）。
- 驗證邏輯仍然係 provider 形狀 → 將來換 Cognito 只係換 provider，唔使改路由。

另外兩個坑：
- **Lambda code 喺 S3 改咗內容，CFN 唔會更新** → 每次要用**新 key**（帶 timestamp）先至偵測到。`scripts/deploy-api.sh` 已處理。
- **讀 CFN outputs 唔可以靠順序** → `Outputs[?OutputKey=='X'].OutputValue` 逐個 key 取（曾經攞錯欄，令 DynamoDB tableName 收到 SQS URL）。

## 部署（可重現）

```bash
npm install
npx esbuild ... # 腳本內自動
bash scripts/deploy-api.sh            # 打包 → 上傳 → package → deploy → curl 驗證
bash scripts/deploy-api.sh --token my-token   # 或者指定 token
```

Token 會寫入 `.relay-token`（唔入版控）。

## 測試

```bash
npm test        # 17 條：authorizer 5 + API 7 + handler 認證 5
npx tsc --noEmit
```

## 成本守衛（同 stack 一齊部署）

| 資源 | 內容 |
|---|---|
| `MonthlyBudget` | 月度 $5 預算（SQS/DynamoDB/Lambda/Polly）→ 80% 電郵告警、100% SNS 告警 |
| `CostTopic` | 成本告警 SNS topic |
| `UsageDashboard` | CloudWatch dashboard：Lambda invocations/errors、SQS messages sent、DynamoDB consumed capacity |

**未做**：單任務預算上限嘅代碼（時間/token 上限 → 中止 → partial → 通知）。
