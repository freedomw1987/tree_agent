#!/usr/bin/env bash
# M02 API 部署（可重現）
#   bash scripts/deploy-api.sh [--token <token>]
#
# 做咗乜：
#   1. esbuild 打包 authorizer + api（Lambda 用 .mjs）
#   2. zip → 上傳 S3（帶 timestamp key → CFN 偵測到 code 變更）
#   3. aws cloudformation package → deploy（參數由 relay stack 讀）
#   4. curl 驗證（無 token / 錯 token / 有效 token）
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REGION="${AWS_REGION:-ap-southeast-1}"
RELAY_STACK="${RELAY_STACK:-voice-agent-m02-relay}"
API_STACK="${API_STACK:-voice-agent-m02-api}"
BUCKET="${ARTIFACT_BUCKET:-aws-sam-cli-managed-default-samclisourcebucket-8i6xs8grlsex}"
ALERT_EMAIL="${ALERT_EMAIL:-david.chu@example.com}"
TOKEN="${2:-}"

cd "$ROOT"

echo "▸ 打包（esbuild）"
npx esbuild src/authorizer.ts --bundle --platform=node --target=node22 --format=esm \
  --outfile=dist/authorizer.mjs >/dev/null
npx esbuild src/handler.ts --bundle --platform=node --target=node22 --format=esm \
  --outfile=dist/handler.mjs --banner:js="import{createRequire}from'module';const require=createRequire(import.meta.url);" >/dev/null
rm -rf build && mkdir -p build/api build/authorizer
cp dist/authorizer.mjs build/authorizer/index.mjs
cp dist/handler.mjs build/api/index.mjs
(cd build/authorizer && zip -q ../../authorizer.zip index.mjs)
(cd build/api && zip -q ../../api.zip index.mjs)

echo "▸ 讀 relay stack 輸出（逐個 key 取 —— 唔可以靠順序，假設順序會攞錯欄）"
stack_out() {
  aws cloudformation describe-stacks --stack-name "$RELAY_STACK" --region "$REGION" \
    --query "Stacks[0].Outputs[?OutputKey=='$1'].OutputValue" --output text
}
TQ="$(stack_out TasksQueueUrl)"
RQ="$(stack_out ResultsQueueUrl)"
TT="$(stack_out TranscriptTable)"
TK="$(stack_out TaskTable)"
echo "  queue=$TQ"
echo "  transcriptTable=$TT  taskTable=$TK"

if [ -z "$TOKEN" ]; then
  TOKEN="va_live_$(openssl rand -hex 8)"
  echo "▸ 新 token: $TOKEN"
fi
echo "$TOKEN" > .relay-token

echo "▸ 上傳 artifacts（帶 timestamp key）"
TS="$(date +%s)"
aws s3 cp authorizer.zip "s3://$BUCKET/voice-agent-m02/authorizer-$TS.zip" --region "$REGION" >/dev/null
aws s3 cp api.zip "s3://$BUCKET/voice-agent-m02/api-$TS.zip" --region "$REGION" >/dev/null

echo "▸ package + deploy"
aws cloudformation package --template-file infra/api-stack.yaml --s3-bucket "$BUCKET" \
  --output-template-file /tmp/api-packaged.yaml --region "$REGION" >/dev/null
aws cloudformation deploy --stack-name "$API_STACK" --template-file /tmp/api-packaged.yaml \
  --capabilities CAPABILITY_IAM --no-fail-on-empty-changeset --region "$REGION" \
  --parameter-overrides \
    TasksQueueUrl="$TQ" ResultsQueueUrl="$RQ" TranscriptTable="$TT" TaskTable="$TK" \
    RelayToken="$TOKEN" RelayUserId="u-1" AlertEmail="$ALERT_EMAIL" \
    ArtifactBucket="$BUCKET" \
    AuthorizerKey="voice-agent-m02/authorizer-$TS.zip" \
    ApiKey="voice-agent-m02/api-$TS.zip" | tail -2

API_URL=$(aws cloudformation describe-stacks --stack-name "$API_STACK" --region "$REGION" \
  --query "Stacks[0].Outputs[?OutputKey=='ApiUrl'].OutputValue" --output text)
echo "▸ API: $API_URL"

echo "▸ 驗證"
for h in "" "Bearer wrong_token" "Bearer $TOKEN"; do
  if [ -z "$h" ]; then
    code=$(curl -s -o /tmp/relay-check.json -w "%{http_code}" -X POST "$API_URL/tasks" \
      -H "content-type: application/json" -d '{"text":"測試"}')
  else
    code=$(curl -s -o /tmp/relay-check.json -w "%{http_code}" -X POST "$API_URL/tasks" \
      -H "authorization: $h" -H "content-type: application/json" -d '{"text":"幫我寫封 email 俾客戶"}')
  fi
  echo "  '${h:-（無 token）}' → HTTP $code $(head -c 140 /tmp/relay-check.json)"
done
echo "▸ transcript:"
curl -s -o /tmp/relay-t.json -w "  HTTP %{http_code}\n" "$API_URL/transcript" -H "authorization: Bearer $TOKEN"
head -c 300 /tmp/relay-t.json; echo
