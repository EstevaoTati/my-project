#!/usr/bin/env bash
# One-command deploy of the Hermes agent + Telegram gateway on a fresh
# Debian/Ubuntu VPS (or any Linux box with normal internet egress).
#
# Distills docs/hermes-setup.md — the config below reproduces the exact
# working state verified live on 2026-07-18 (provider anthropic, top-level
# composite model key, local Whisper STT, Edge TTS).
#
# Usage:
#   ANTHROPIC_API_KEY=sk-ant-... TELEGRAM_BOT_TOKEN=123:abc ./deploy-hermes.sh
#   (or run it bare and it will prompt for both)
#
# Re-running is safe: existing clone, venv, and .env values are kept.

set -euo pipefail

HERMES_DIR="${HERMES_DIR:-$HOME/hermes-agent}"
HERMES_ENV="$HOME/.hermes/.env"
MODEL="${HERMES_MODEL:-anthropic/claude-sonnet-5}"

say() { printf '\n\033[1;33m==> %s\033[0m\n' "$*"; }

# ---------- prerequisites ----------
say "Checking prerequisites"
command -v git >/dev/null || { echo "git is required (apt install git)"; exit 1; }
if ! command -v uv >/dev/null; then
  say "Installing uv"
  curl -LsSf https://astral.sh/uv/install.sh | sh
  export PATH="$HOME/.local/bin:$PATH"
fi

# ---------- credentials ----------
mkdir -p "$HOME/.hermes"
touch "$HERMES_ENV" && chmod 600 "$HERMES_ENV"

ensure_env() { # ensure_env VAR_NAME "prompt text"
  local var="$1" prompt="$2" val=""
  if grep -q "^${var}=" "$HERMES_ENV"; then
    echo "  ${var}: already in $HERMES_ENV (kept)"
    return
  fi
  val="${!var:-}"
  if [ -z "$val" ]; then
    read -r -s -p "  ${prompt}: " val; echo
  fi
  [ -n "$val" ] || { echo "${var} is required"; exit 1; }
  printf '%s=%s\n' "$var" "$val" >> "$HERMES_ENV"
}

say "Configuring credentials in $HERMES_ENV"
ensure_env ANTHROPIC_API_KEY "Anthropic API key (console.anthropic.com)"
ensure_env TELEGRAM_BOT_TOKEN "Telegram bot token (@BotFather -> /newbot)"

# Gotcha from the runbook: a leftover key for another provider makes Hermes
# route through OpenRouter. Keep only the Anthropic key.
if grep -qE '^(OPENAI|OPENROUTER)_API_KEY=' "$HERMES_ENV"; then
  echo "  WARNING: non-Anthropic provider key found in $HERMES_ENV — remove it," \
       "or Hermes may route through the wrong provider."
fi

# ---------- install ----------
if [ ! -d "$HERMES_DIR/.git" ]; then
  say "Cloning hermes-agent into $HERMES_DIR"
  git clone https://github.com/NousResearch/hermes-agent.git "$HERMES_DIR"
else
  say "Existing clone found in $HERMES_DIR (kept)"
fi
cd "$HERMES_DIR"

say "Installing Hermes (cli, anthropic, voice, edge-tts, messaging)"
[ -d .venv ] || uv venv --python 3.11 .venv
uv pip install --python .venv -e ".[cli,anthropic,voice,edge-tts,messaging]"
HERMES="$HERMES_DIR/.venv/bin/hermes"

# ---------- configuration (the verified working state) ----------
say "Writing Hermes config"
"$HERMES" config set agent.provider anthropic
# Critical: the model must be set on the TOP-LEVEL key in provider/model form,
# or one-shot mode fails with an empty model string (see docs/hermes-setup.md).
"$HERMES" config set model "$MODEL"
"$HERMES" config set stt.enabled true
"$HERMES" config set stt.provider local
"$HERMES" config set stt.local.model base
"$HERMES" config set tts.enabled true
"$HERMES" config set tts.provider edge

# ---------- smoke test ----------
say "Smoke test (hermes -z)"
if OUT=$("$HERMES" -z "Reply with exactly: hermes-ok" 2>&1) && echo "$OUT" | grep -q "hermes-ok"; then
  echo "  OK — Hermes reaches the Claude API."
else
  echo "  FAILED. Output was:"; echo "$OUT"
  echo "  Check the API key and credits (console.anthropic.com -> Plans & Billing)."
  exit 1
fi

# ---------- systemd service for the Telegram gateway ----------
say "Installing systemd service (hermes-gateway)"
UNIT_DIR="$HOME/.config/systemd/user"
mkdir -p "$UNIT_DIR"
cat > "$UNIT_DIR/hermes-gateway.service" <<UNIT
[Unit]
Description=Hermes Telegram gateway (MWINDA OS channel)
After=network-online.target

[Service]
ExecStart=$HERMES gateway
WorkingDirectory=$HERMES_DIR
Restart=always
RestartSec=5

[Install]
WantedBy=default.target
UNIT

systemctl --user daemon-reload
systemctl --user enable --now hermes-gateway.service
# Keep the user service running after logout (VPS use case).
loginctl enable-linger "$USER" 2>/dev/null || true

say "Done"
cat <<'EOF'
  Gateway is running. Next:
   1. Open Telegram, message your bot (text or a voice memo).
      First voice memo downloads the Whisper 'base' model — allow a minute.
   2. Logs:    systemctl --user status hermes-gateway
               journalctl --user -u hermes-gateway -f
   3. SECURITY: anyone who finds the bot handle can talk to it on your API
      budget. Keep the handle private, check Hermes gateway settings for a
      user allowlist, and keep a hard spend cap set in the Anthropic Console.
EOF
