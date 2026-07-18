# Hermes Agent — setup state and runbook

Status as of 2026-07-17. Hermes (NousResearch/hermes-agent) was evaluated as
a candidate runtime for the MWINDA OS agent ecosystem — it has built-in
persistent memory, self-improving skills, cron automations, and a
Telegram/Discord/Slack gateway.

## What was done (in an ephemeral Claude Code container — will not survive)

Working copy lived at `/home/user/hermes-agent`. Completed there:

1. Cloned `https://github.com/NousResearch/hermes-agent.git`.
2. `uv venv --python 3.11 .venv` and `uv pip install -e ".[cli,anthropic]"`.
3. Built the TUI: `cd ui-tui && npm install && npm run build:ink && npm run build`.
4. Configured `~/.hermes/config.yaml`: `agent.provider: anthropic`,
   `agent.model: claude-sonnet-5`.
5. Verified `api.anthropic.com` is reachable from Claude Code remote
   containers (the proxy bypasses `*.anthropic.com`); `api.openai.com` is
   blocked by the environment's network policy.

## What is pending (owner: founder)

- **Anthropic API key**: create at console.anthropic.com → Settings → API
  Keys; store as `ANTHROPIC_API_KEY=...` in `~/.hermes/.env` (mode 600).
- If OpenAI is wanted instead: allow `api.openai.com` in the Claude Code
  environment network policy (takes effect in new sessions only), and
  rotate the OpenAI key that was pasted into chat on 2026-07-17.

## To reproduce from scratch (≈10 min on any Linux box)

```bash
git clone https://github.com/NousResearch/hermes-agent.git && cd hermes-agent
uv venv --python 3.11 .venv
uv pip install --python .venv -e ".[cli,anthropic]"
echo 'ANTHROPIC_API_KEY=sk-ant-...' > ~/.hermes/.env && chmod 600 ~/.hermes/.env
.venv/bin/hermes config set agent.provider anthropic
.venv/bin/hermes config set agent.model claude-sonnet-5
.venv/bin/hermes -z "Reply with exactly: hermes-ok"   # smoke test
.venv/bin/hermes --tui                                 # interactive TUI (needs a real TTY)
```

Note: the TUI refuses to start without a real terminal (`hermes-tui: no TTY`),
so it cannot run inside headless containers — use `-z` one-shot mode there.
