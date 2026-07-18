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

## Update 2026-07-18 (later): voice interaction — installed, blocked by sandbox network

Goal: talk to Hermes with voice memos (phone → Telegram → Hermes transcribes
→ replies, optionally with synthesized speech).

Done in the container (portable via the steps below):

- Installed extras: `uv pip install -e ".[voice,edge-tts,messaging]"`
  (faster-whisper local STT, Edge TTS, Telegram/Discord/Slack SDKs).
- Configured `~/.hermes/config.yaml`: `stt.enabled: true`,
  `stt.provider: local`, `stt.local.model: base`, `tts.enabled: true`,
  `tts.provider: edge`.
- TLS through corporate-style proxies: append the proxy CA to the venv's
  certifi bundle (`cat <ca.crt> >> $(.venv/bin/python -c "import certifi;
  print(certifi.where())")`) — never disable verification.

Blocked in the Claude Code sandbox (network policy denies all three):
`speech.platform.bing.com` (Edge TTS), `huggingface.co` (Whisper model
download), `api.telegram.org` (gateway). Voice therefore cannot run in that
sandbox; it works anywhere with normal egress.

### To go live with voice (on a VPS or laptop)

1. Reproduce the base install (see above), adding `.[voice,edge-tts,messaging]`.
2. Create a Telegram bot: message @BotFather → `/newbot` → copy the token.
3. `hermes gateway` setup: add `TELEGRAM_BOT_TOKEN=...` to `~/.hermes/.env`,
   then run `hermes gateway` (long-running process; systemd or tmux).
4. Send the bot a voice memo. Hermes transcribes it locally (Whisper `base`
   model, downloaded on first use), answers via the configured Claude model,
   and can reply with Edge TTS audio.

Prerequisite unchanged: Anthropic API credits (see previous update).

## Update 2026-07-18 (final): LIVE — end-to-end verified with credits

After credits were added, `hermes -z "Reply with exactly: hermes-ok"`
returned `hermes-ok`. Hermes → Claude API inference is fully operational.

Two final configuration facts learned the hard way:

- The model must be set on the **top-level** `model` key in composite
  `provider/model` form: `hermes config set model anthropic/claude-sonnet-5`.
  Setting `agent.model` / `agent.provider` alone leaves the one-shot (`-z`)
  path with an empty model string ("model: String should have at least 1
  character" from the API).
- Flags also work per-invocation: `hermes -m claude-sonnet-5 --provider
  anthropic -z "..."`.

Working state: provider anthropic, model claude-sonnet-5, key in
`~/.hermes/.env`, proxy env stripped when running inside the Claude Code
sandbox. Remaining founder items: rotate both chat-pasted keys; for voice,
deploy per the voice section above.
