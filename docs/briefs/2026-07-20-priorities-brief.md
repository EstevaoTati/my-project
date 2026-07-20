# Monday Priorities Brief — 2026-07-20

*Produced manually in-session: the scheduled routine did not deliver at 07:00
UTC (no brief PR found, `docs/briefs/` did not exist). Investigate the
trigger this week — see open loop #5.*

## Last 14 days — what actually shipped

- **MWINDA OS went live on the public site** (PRs #10–#11, merged Jul 20):
  `os.html` with the "Talk to the OS" chat — public demo persona + private
  founder kernel mode (`/os <key>`), Netlify Function proxy, env-var-only
  secrets, verified end-to-end with the production key.
- **Full rebrand to MWINDA DIGITAL** (PR #12, merged Jul 20): English by
  default, five 100% digital/AI poles (Agentic AI Systems, Automation, AI
  Training, Digital Incubation, AI Consulting), WhatsApp-connected contact
  form, floating OS button. Live at polite-cendol-dbf4d6.netlify.app.
- **Hermes verified live** on the Claude API (PRs #7–#9) and packaged into a
  one-command VPS deploy (`scripts/deploy-hermes.sh`). Telegram gateway
  ready — blocked only on renting a VPS.
- **OS infrastructure hardened**: kernel refreshed, decision records,
  regenerated Netlify package.

## Top 3 priorities this week

1. **Turn the new positioning into one sales conversation.** The site now
   sells five AI poles and hands leads to WhatsApp. Objective: one
   qualified prospect through the funnel (share the site, watch the widget
   + WhatsApp messages, respond same-day). Revenue validates the rebrand;
   nothing else does.
2. **Decide on PR #4 — the Next.js platform.** A complete product
   (bilingual site, agent sandbox, client/admin dashboards, Stripe) has
   been sitting in draft since Jul 6. It overlaps the current static-site
   strategy. Decide: adopt as the product base behind a subdomain
   (app.mwindadigital), keep parked with a revisit date, or close it.
   A parked asset this large is a silent liability.
3. **Security hygiene, 15 minutes.** Rotate the Anthropic API key (it
   passed through chat on Jul 20) and swap it in Netlify; confirm the
   monthly spend cap is actually set; store the founder key in a password
   manager.

## Open loops

1. Hermes/Telegram: rent VPS → `./scripts/deploy-hermes.sh` (~30 min).
2. PR #3 (personal portfolio) in draft since Jul 6 — decide or close.
3. Netlify site name (`polite-cendol-...` → `mwindadigital`) and custom
   domain purchase.
4. Social links in the site footer still point to `#`.
5. **Monday brief routine failed silently** — verify the trigger fired,
   check its session, or recreate it. A routine that fails without alerting
   defeats its purpose; consider adding failure notifications.
6. Old API keys pasted in chats (Jul 17–20) — rotation covers this.

## Status board

| System | State |
|---|---|
| Site + OS (public & kernel mode) | Live, verified with production key |
| WhatsApp lead funnel | Live as of today — untested with a real lead |
| Hermes Telegram | Scripted, awaiting VPS |
| Monday brief routine | **Failed this week — needs investigation** |
| Spend cap / key rotation | Owner action pending |
