#!/usr/bin/env bash
# 本機閘點跑（Gate 2 lint + Gate 3 改動範圍回歸）
# 用法：
#   bash scripts/check-all.sh            # 全量
#   bash scripts/check-all.sh --changed  # 只跑受改動影響嘅範圍
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CHANGED_ONLY=0
[[ "${1:-}" == "--changed" ]] && CHANGED_ONLY=1

declare -a STEPS=()
declare -a RESULTS=()

run_step() {
  local name="$1"; shift
  echo ""
  echo "── $name ──"
  if "$@"; then
    RESULTS+=("✅ $name")
  else
    RESULTS+=("❌ $name")
    return 1
  fi
}

# 1. 型別檢查（spike：relay-transport）
run_step "lint: spikes/relay-transport (tsc --noEmit)" \
  bash -c "cd '$ROOT/spikes/relay-transport' && npx tsc --noEmit"

# 2. 探針（spike contract 測試）
run_step "probe: spikes/relay-transport (vitest run)" \
  bash -c "cd '$ROOT/spikes/relay-transport' && npx vitest run --reporter=dot"

# 2b. 探針（sidecar：session host / IPC / supervisor）
run_step "lint: runtime/sidecar (tsc --noEmit)" \
  bash -c "cd '$ROOT/runtime/sidecar' && npx tsc --noEmit"

run_step "probe: runtime/sidecar (vitest run)" \
  bash -c "cd '$ROOT/runtime/sidecar' && npx vitest run --reporter=dot"

# 2c. 探針（relay：冪等 / transcript cursor / queue ack）
run_step "lint: runtime/relay (tsc --noEmit)" \
  bash -c "cd '$ROOT/runtime/relay' && npx tsc --noEmit"

run_step "probe: runtime/relay (vitest run)" \
  bash -c "cd '$ROOT/runtime/relay' && npx vitest run --reporter=dot"

# 2d. 探針（relay-api：authorizer / HTTP API / handler 認證）
run_step "lint: runtime/relay-api (tsc --noEmit)" \
  bash -c "cd '$ROOT/runtime/relay-api' && npx tsc --noEmit"

run_step "probe: runtime/relay-api (vitest run)" \
  bash -c "cd '$ROOT/runtime/relay-api' && npx vitest run --reporter=dot"

# 2e. 探針（macOS Tauri 殼：Rust supervisor + IPC）
run_step "probe: apps/tauri-mac (cargo test)" \
  bash -c "cd '$ROOT/apps/tauri-mac/src-tauri' && cargo test --quiet 2>&1 | tail -3"

# 3. 原型 smoke（demo 路線 + 跨 Surface 串連）
run_step "probe: prototype/voice-agent (smoke)" \
  bash -c "cd '$ROOT/prototype/voice-agent' && node scripts/smoke.mjs"

# 4. 文件自查（AC / 錨點 / 連結）
# 2f. 端到端（真 Pi SDK ＋ 真工具 ＋ 真確認流程）—— 需要網絡同模型額度，預設跳過
if [ "${RUN_E2E:-0}" = "1" ]; then
  run_step "probe: sidecar 端到端（Agent → 工具 → 確認卡 → 執行）" \
    bash -c "cd '$ROOT/runtime/sidecar' && npm run build --silent && node scripts/e2e-tool-flow.mjs"
else
  echo "⏭️  略過：sidecar 端到端（RUN_E2E=1 先跑）"
fi

run_step "probe: docs self-check" \
  bash -c "cd '$ROOT' && node scripts/selfcheck-docs.mjs"

echo ""
echo "══════ 結果 ══════"
for r in "${RESULTS[@]}"; do echo "  $r"; done
if printf '%s\n' "${RESULTS[@]}" | grep -q "❌"; then
  echo ""
  echo "❌ 有步驟失敗"
  exit 1
fi
echo ""
echo "✅ 全綠${CHANGED_ONLY:+（--changed 模式）}"
