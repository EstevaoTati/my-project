# MWINDA AI Business Intelligence — MVP build

**Date:** 2026-08-22 · **Status:** shipped (validation slice)

## Decision

Build the AI engine and the full six-stage user journey **on the existing
static platform**, not as a new SaaS. No accounts, no database, no payments in
this version.

## Why not build the full SaaS described in the brief

The brief (§19) specifies Next.js, auth, a projects/users/documents database,
a PDF engine and a regulatory knowledge base. That is a real SaaS and it is
the right destination — but building it now answers the wrong question.

The brief's own §28 names the question that matters: *are entrepreneurs
willing to use and pay for this?* Accounts, billing and a database are the
machinery you need **after** the answer is yes. Every week spent on them
before that is a week spent on infrastructure for a demand that has not been
demonstrated.

Two facts made the decision easy:

1. **The SaaS foundation already exists in this repository.** PR #4 — open in
   draft since 2026-07-06 — is a complete Next.js 15 + TypeScript platform:
   bilingual site, agent sandbox, client and admin dashboards, Prisma schema,
   Stripe checkout and webhooks, session auth. If validation succeeds, AI
   Business Intelligence should be built **into that**, not rebuilt from
   scratch. Writing a second SaaS while a finished one sits parked would be
   the most expensive mistake available here.
2. **The engine is the hard part, and it is portable.** Six prompt/schema
   pairs, a financial model and a document assembler work identically behind a
   static page or a Next.js app. Nothing built here has to be thrown away.

So: ship the value, defer the machinery.

## What shipped

`bi.html` / `bi.css` / `bi.js` + `netlify/functions/bi.mjs`, at `/bi`.

Six stages, generated one at a time so the user edits between them and a
failure never costs a whole dossier: **idea analysis → business model canvas →
17-section business plan → financial projections → regulatory checklist →
execution roadmap → printable dossier.**

### Engineering decisions worth recording

**The model proposes assumptions; JavaScript does the arithmetic.**
LLMs are unreliable at multi-step arithmetic, and a business plan whose
numbers do not add up is worse than no plan. The `financials` stage returns
only assumptions (price, cost to serve, customers, growth, fixed costs); the
browser computes the 12-month projection, break-even, cumulative cash, funding
need and the three scenarios. Consequence: every figure is internally
consistent, and changing any input recalculates everything live. Verified in
test — revenue − expenses equals net across all three scenarios and the
monthly table.

**Structured output via tool-use, not parsed prose.** Every stage returns
JSON validated against a schema. No brittle text parsing.

**Streaming NDJSON, forced by the platform.** A stage takes 20–120 s, far past
Netlify's synchronous response window. The function streams `{start}`,
`{progress}`, `{result}` lines: the first byte leaves immediately, bytes keep
flowing, and the user sees real progress instead of a frozen button.

**Truncation is an error, never a silent partial.** A `max_tokens` stop still
yields partial JSON. Delivering half an analysis as if complete would be worse
than failing, so the function checks `stop_reason` and required keys and
returns an error. This caught two real bugs in testing (`analyze` at 4 000
tokens, `plan` at 8 000) — ceilings are now 6 500 and 16 000.

**PDF by print stylesheet, not a server engine.** `@media print` turns the
dark console into a white document. Zero infrastructure, works offline, and
the browser's "Save as PDF" produces a genuinely professional file. A server
PDF engine buys control we do not need yet.

**Regulatory output is structurally hedged.** Every item carries a confidence
rating, the authority that typically handles it, and who to confirm with; the
prompt forbids inventing statute numbers, fees and deadlines; a banner states
plainly that this is general information, not legal advice. This is the
highest-liability feature in the product and it is treated as such.

## Deliberately out of scope

Accounts, database, payments, market data (the analysis is reasoning, not
researched data — the plan says so explicitly), multi-user projects, the
consultant marketplace, and coverage claims for any jurisdiction. Projects
live in `localStorage`: private to the browser, lost if it is cleared. That is
an honest MVP limitation, not a hidden one.

## Cost and controls

A full dossier is roughly 30–40 k output tokens. `BI_MODEL` (default
`claude-sonnet-5`) switches model; `BI_ENABLED=false` is the kill switch;
per-IP limits allow ~6 dossiers/hour, with a global hourly ceiling. The
Anthropic monthly spend cap remains the only hard financial guarantee.

## Next decision, not now

If usage shows people completing dossiers and asking to keep them: adopt PR #4
as the product base, port these six stages into it, and add accounts and
Stripe. If usage shows they generate one and never return, the engine was
cheap and the SaaS was correctly not built.
