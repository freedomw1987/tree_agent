#!/usr/bin/env bash
# iOS 真機部署前置檢查（macOS）
#
#   bash scripts/ios-device-setup.sh            # 只檢查
#   bash scripts/ios-device-setup.sh --team ABCDE12345   # 順手寫入 development team
#
# 檢查嘢：Xcode / iOS runtime / 簽名身份 / 已連接實機 / Xcode Apple ID / bundle id
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CONF="$ROOT/apps/tauri-mobile/src-tauri/tauri.conf.json"
TEAM="${2:-}"

ok=0; warn=0; fail=0
say_ok()   { printf '  ✅ %s\n' "$1"; ok=$((ok+1)); }
say_warn() { printf '  ⚠️  %s\n' "$1"; warn=$((warn+1)); }
say_fail() { printf '  ❌ %s\n' "$1"; fail=$((fail+1)); }
say_info() { printf '  ℹ️  %s\n' "$1"; }

echo "═══ iOS 真機部署前置檢查 ═══"

# 1) Xcode
if xcodebuild -version >/dev/null 2>&1; then
  say_ok "Xcode：$(xcodebuild -version | head -1)"
else
  say_fail "冇 Xcode（去 App Store 裝，或者 xcode-select --install）"
fi

# 2) iOS runtime（真機唔需要 simulator runtime，但要有 SDK）
SDK=$(xcrun --sdk iphoneos --show-sdk-path 2>/dev/null)
if [ -n "$SDK" ]; then
  say_ok "iOS SDK：$(xcrun --sdk iphoneos --show-sdk-version 2>/dev/null)"
else
  say_fail "冇 iOS SDK（Xcode → Settings → Components 裝 iOS platform）"
fi

# 3) 簽名身份
IDENTITIES=$(security find-identity -v -p codesigning 2>/dev/null | grep -c "Apple Development" || true)
if [ "${IDENTITIES:-0}" -gt 0 ]; then
  say_ok "簽名身份：$(security find-identity -v -p codesigning | grep 'Apple Development' | head -1)"
else
  say_fail "冇簽名身份 → Xcode 登入 Apple ID（Settings → Accounts）並建立 Certificate"
fi

# 4) Xcode 登入嘅 team
# ⚠️ 唔可以用 regex 抽大寫字串（會抽中帳戶 UUID）→ 要讀 teamID 欄
TEAMS=$(defaults read com.apple.dt.Xcode IDEProvisioningTeamByIdentifier 2>/dev/null \
  | grep -E 'teamID|teamName' | sed 's/^[[:space:]]*//' | tr '\n' ' ')
if [ -n "$TEAMS" ]; then
  say_ok "Xcode 已有開發 team：${TEAMS}"
else
  say_warn "Xcode 未登入 Apple ID（冇 team 就簽唔到名）"
fi

# 5) 實機
DEVICE=$(xcrun xctrace list devices 2>/dev/null | grep -E "^\s+iPhone" | grep -v Simulator | head -1)
if [ -n "$DEVICE" ]; then
  say_ok "已連接實機：$(echo "$DEVICE" | xargs)"
else
  say_warn "冇接實機（插線 + 信任部 Mac；或者喺 Xcode → Window → Devices 睇）"
fi

# 6) bundle id
BUNDLE=$(python3 -c "import json;print(json.load(open('$CONF'))['identifier'])" 2>/dev/null)
say_info "bundle id：$BUNDLE（要同 Apple Developer portal 入面一致）"

# 7) 寫入 development team
if [ -n "$TEAM" ]; then
  python3 - "$CONF" "$TEAM" <<'PY'
import json, sys
path, team = sys.argv[1], sys.argv[2]
with open(path) as f:
    cfg = json.load(f)
bundle = cfg.setdefault("bundle", {})
ios = bundle.setdefault("iOS", {})
ios["developmentTeam"] = team
with open(path, "w") as f:
    json.dump(cfg, f, indent=2, ensure_ascii=False)
    f.write("\n")
print(f"  ✅ 已寫入 developmentTeam={team}")
PY
fi

echo
echo "═══ 結果：$ok 項通過 · $warn 項提醒 · $fail 項要處理 ═══"
if [ "$fail" -gt 0 ]; then
  echo "下一步：睇 docs/deploy-ios-device.md（逐步指引）"
  exit 1
fi
echo "可以打包真機：cd apps/tauri-mobile && npx tauri ios build --device"
