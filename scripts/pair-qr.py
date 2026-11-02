#!/usr/bin/env python3
"""
產生「手機配對」QR code（畀 Voice Agent 手機 App 掃）

Payload（JSON）：
  { "v": 1, "apiUrl": "...", "token": "...", "ts": 1750000000000 }

用法：
  runtime/tools/.venv/bin/python scripts/pair-qr.py --out ~/Desktop/pair-qr.png
  runtime/tools/.venv/bin/python scripts/pair-qr.py --open      # 直接開 Preview

Token 來源（優先次序）：
  1. --token
  2. 環境變數 VA_RELAY_TOKEN
  3. runtime/relay-api/.relay-token
"""
import argparse
import json
import os
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DEFAULT_TOKEN_FILE = ROOT / "runtime" / "relay-api" / ".relay-token"
DEFAULT_API_URL = "https://nqh8j1u2a0.execute-api.ap-southeast-1.amazonaws.com"


def read_token(explicit: str | None) -> str:
    if explicit:
        return explicit.strip()
    env = os.environ.get("VA_RELAY_TOKEN", "").strip()
    if env:
        return env
    if DEFAULT_TOKEN_FILE.exists():
        return DEFAULT_TOKEN_FILE.read_text(encoding="utf-8").strip()
    sys.exit(
        "搵唔到 token：\n"
        f"  · 環境變數 VA_RELAY_TOKEN\n"
        f"  · 或者 {DEFAULT_TOKEN_FILE}\n"
        "（Mac 上面行：cat runtime/relay-api/.relay-token）"
    )


def main() -> None:
    ap = argparse.ArgumentParser(description="產生手機配對 QR code")
    ap.add_argument("--out", default=str(Path.home() / "Desktop" / "voice-agent-pair.png"))
    ap.add_argument("--token", default=None, help="relay token（預設讀環境變數／.relay-token）")
    ap.add_argument("--api-url", default=os.environ.get("VA_RELAY_API_URL", DEFAULT_API_URL))
    ap.add_argument("--open", action="store_true", help="生成後用 Preview 開啟")
    args = ap.parse_args()

    try:
        import qrcode
    except ImportError:
        sys.exit(
            "未裝 qrcode。跑呢句先：\n"
            "  runtime/tools/.venv/bin/pip install qrcode\n"
            "（或者：python3 -m venv runtime/tools/.venv && runtime/tools/.venv/bin/pip install qrcode）"
        )

    token = read_token(args.token)
    payload = {
        "v": 1,
        "kind": "voice-agent-pairing",
        "apiUrl": args.api_url,
        "token": token,
        "ts": int(time.time() * 1000),
    }
    data = json.dumps(payload, ensure_ascii=False, separators=(",", ":"))

    qr = qrcode.QRCode(
        version=None,
        error_correction=qrcode.constants.ERROR_CORRECT_M,
        box_size=8,
        border=3,
    )
    qr.add_data(data)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")

    out = Path(args.out).expanduser()
    out.parent.mkdir(parents=True, exist_ok=True)
    img.save(out)
    print(f"✅ QR 已生成：{out}")
    print(f"   payload：{len(data)} 字元（apiUrl + token）")
    print("   喺手機 App 撳「掃描配對」，對住呢個 QR 掃一下就得。")
    if args.open:
        subprocess.run(["open", str(out)], check=False)


if __name__ == "__main__":
    main()
