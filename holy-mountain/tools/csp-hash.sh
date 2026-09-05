#!/usr/bin/env bash
# Recompute the Content-Security-Policy hash for the inline JSON-LD block in
# holy-mountain/index.html and print the script-src line to paste into
# netlify.toml. Run this after ANY edit to that <script type="application/ld+json">
# block, or the structured data will be blocked by the policy.
set -euo pipefail
cd "$(dirname "$0")/.."
HASH=$(python3 - <<'PY'
import base64, hashlib, re
html = open('index.html', encoding='utf-8').read()
m = re.search(r'<script type="application/ld\+json">(.*?)</script>', html, re.S)
if not m:
    raise SystemExit('No JSON-LD block found in index.html')
print(base64.b64encode(hashlib.sha256(m.group(1).encode()).digest()).decode())
PY
)
echo "script-src 'self' 'sha256-${HASH}';"
