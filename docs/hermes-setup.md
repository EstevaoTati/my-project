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

## Update 2026-07-18: connected end-to-end, blocked only on billing

The Anthropic key was added to `~/.hermes/.env` and verified: Hermes reaches
`api.anthropic.com`, authenticates, and requests `claude-sonnet-5`. The API
returns "credit balance too low" — the last gate is purchasing credits at
console.anthropic.com → Plans & Billing.

Two gotchas discovered, both already handled in config:

1. **Proxy bypass**: in Claude Code remote containers, run Hermes with proxy
   env stripped (`env -u HTTPS_PROXY -u https_proxy -u HTTP_PROXY
   -u http_proxy -u ALL_PROXY -u all_proxy hermes ...`) — Hermes routes
   through `HTTPS_PROXY` without honoring the `NO_PROXY` bypass for
   `anthropic.com`, and the proxy rejects the CONNECT. On a normal machine
   (no proxy env) this doesn't apply.
2. **Stray provider keys**: a leftover `OPENAI_API_KEY` in `~/.hermes/.env`
   made Hermes route via OpenRouter despite `provider: anthropic`. Keep only
   the key for the active provider.

## What is pending (owner: founder)

- **Buy API credits**: console.anthropic.com → Plans & Billing. Everything
  else is verified working; after credits, `hermes -z "test"` succeeds.
- Rotate both keys pasted into chat (OpenAI on 2026-07-17, Anthropic on
  2026-07-18) once testing is done.

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
