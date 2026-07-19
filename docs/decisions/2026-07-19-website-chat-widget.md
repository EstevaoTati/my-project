# Decision: Client-facing chat widget on os.html, not a founder OS console

**Date:** 2026-07-19 · **Status:** Shipped (branch `claude/claude-md-docs-jyte9k`, PR #10)

## Decision

Add a public demo chat ("Talk to the OS", Layer 05 on `os.html`) backed by a
Netlify Function (`netlify/functions/chat.mjs`) that proxies to the Claude API:

- Key stays server-side in the `ANTHROPIC_API_KEY` Netlify env var; the
  static frontend never sees it.
- Scoped system prompt: Mwinda sales/FAQ assistant (FR/EN), declines
  off-topic use; `max_tokens` 512; conversation capped at 12 turns /
  8K chars per request; same-origin check; `CHAT_ENABLED=false` kill switch.
- Model: `claude-opus-4-8` by default, overridable via `CHAT_MODEL`
  (e.g. `claude-haiku-4-5` to cut cost ~5x on a public widget).
- Spend backstop is the hard monthly limit at console.anthropic.com — the
  stateless function cannot rate-limit per IP without a datastore.

## Addendum (same day): founder OS mode

The founder wanted to test the OS itself from the same platform. Added a
second mode to the same function: sending `mode: "os"` with a key matching
the `FOUNDER_KEY` Netlify env var (timing-safe compare) switches the system
prompt to the MWINDA OS kernel (mirrors CLAUDE.md: role, priorities,
checklists, communication style) with higher limits (20 turns, 1024 output
tokens). Unlocked in the UI by typing `/os <key>`; `/public` reverts.
Honest constraint, stated in the kernel prompt itself: this surface has no
tools, repo access, or persistence — full execution stays in Claude Code
and Hermes, and durable conclusions must be recorded in the repo.

## Rationale

The founder asked to "interact with the OS directly" from the website. The
website cannot host the real OS: a static site has no secret storage, and a
chat proxy has no repo access, agents, or routines — it would be a persona,
not the OS. Founder access already exists via Claude Code on this repo and
the Hermes Telegram gateway (`docs/hermes-setup.md`). The website widget is
therefore built as what it can honestly be: a client-facing demo and
lead-generation asset.

## Rejected alternatives

- **API key in frontend JS** — publicly readable, guaranteed abuse.
- **Full OS bridge (repo access, agents) behind the website** — duplicates
  Claude Code with worse security and more cost; no benefit over the
  existing channels.

## Follow-ups (owner: founder)

- Set `ANTHROPIC_API_KEY` in Netlify UI and a monthly spend cap in the
  Anthropic Console before the deploy goes live.
- If traffic or abuse grows: add per-IP rate limiting (Netlify Blobs or
  Upstash) and/or a Turnstile challenge.
