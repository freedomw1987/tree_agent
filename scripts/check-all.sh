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

# 3. 原型 smoke（demo 路線 + 跨 Surface 串連）
run_step "probe: prototype/voice-agent (smoke)" \
  bash -c "cd '$ROOT/prototype/voice-agent' && node scripts/smoke.mjs"

# 4. 文件自查（AC / 錨點 / 連結）
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
