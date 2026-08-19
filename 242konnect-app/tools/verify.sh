#!/usr/bin/env bash
#
# Runs the functional suite the way the app actually runs: against a live
# verification service.
#
# Sign-up needs a code that exists only in an e-mail, so the suite reads it from
# the API's outbox rather than the page — the page not having it is one of the
# things under test. That means the API has to be up and its URL has to be baked
# into the build, and getting either wrong produces a wall of confusing
# failures. Hence this script.
#
# Usage:  npm run verify
#
set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
API_DIR="$APP_DIR/../242konnect-api"
API_PORT="${API_PORT:-8979}"
API_LOG="${API_LOG:-/tmp/242konnect-api.log}"
API_URL="http://127.0.0.1:$API_PORT"

if [ ! -x "$API_DIR/.venv/bin/uvicorn" ]; then
  echo "The API venv is missing. Set it up first:" >&2
  echo "  cd $API_DIR && python3 -m venv .venv && ./.venv/bin/pip install -r requirements.txt" >&2
  exit 1
fi

: > "$API_LOG"
"$API_DIR/.venv/bin/uvicorn" app.main:app --port "$API_PORT" --app-dir "$API_DIR" \
  > "$API_LOG" 2>&1 &
API_PID=$!
trap 'kill "$API_PID" 2>/dev/null || true' EXIT

echo "Waiting for the API on port $API_PORT…"
for _ in $(seq 1 40); do
  curl -sf "$API_URL/health" > /dev/null && break
  sleep 0.5
done
curl -sf "$API_URL/health" > /dev/null || { echo "API failed to start; see $API_LOG" >&2; exit 1; }

# --clear matters: Metro caches EXPO_PUBLIC_* into the bundle, so a stale build
# will happily test against an API URL from a previous run.
echo "Building against $API_URL…"
cd "$APP_DIR"
EXPO_PUBLIC_API_URL="$API_URL" npx expo export --platform web --clear > /dev/null

# Playwright is a dev-only dependency and is deliberately not in package.json —
# `npm install` here would prune it back out. Set NODE_PATH to wherever it is
# installed, and CHROMIUM_PATH if its bundled browser build does not match.
echo "Running the suite…"
API_LOG="$API_LOG" node tools/verify-app.js
