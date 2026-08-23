# Security — MWINDA DIGITAL platform

*Owner: the founder. Last hardening pass: 2026-08-23.*

Nothing here claims the platform "cannot be hacked" — no system can. The goal
is narrower and achievable: make an attack **expensive**, **noisy**, and
**low-impact**, and make sure the worst realistic outcome is a capped bill
rather than a breach.

---

## 1. What is actually worth attacking

| # | Asset | Why an attacker wants it | Worst case |
|---|---|---|---|
| 1 | **Ability to spend the Anthropic key** | Free frontier-model inference, resellable | A large bill. The key itself never leaves Netlify env vars. |
| 2 | **`FOUNDER_KEY`** | Unlocks the kernel persona *and* the private briefs | Read internal strategy; impersonate the founder to the OS |
| 3 | **Private briefs / internal docs** | Competitive intelligence | Strategy disclosure |
| 4 | **Site integrity** | The chat speaks *as* Mwinda Digital | A screenshot of it saying something off-brand |

Note the asymmetry: asset #1 is the only one an attacker converts to money
today, so most controls below are aimed at throughput and cost, not secrecy.

## 2. Controls in place

**Authentication (`_security.mjs`)**
- Founder key compared in constant time **after SHA-256 hashing both sides**,
  so neither the result nor the timing leaks the expected key's length.
- Privileged mode refuses to run behind a weak key (< 16 chars or < 8 distinct
  characters). A weak key is worse than none — it looks like security.
- Failed attempts throttled: 5 per 15 min per IP, then a 15-minute lockout,
  applied to **both** the chat's `/os` mode and the briefs endpoint.
- The lockout table evicts only *expired* entries. It never calls `clear()` —
  a wholesale wipe is an attack primitive (flood it with fresh IPs and every
  active lockout is released).

**Throughput / cost**
- Three sliding windows per warm instance: public 8/min per IP, founder
  30/min per IP, and a global 120/min ceiling that applies before any work.
- Request bodies capped (64 KB chat, 4 KB briefs) and byte-counted after
  reading, so a lying `content-length` gains nothing.
- `retry-after` returned on every 429.
- Token usage logged per completion (`chat.completed`), so budget abuse is
  visible in logs rather than first appearing on an invoice.

**Origin**
- Every POST must carry a same-origin `Origin`, and `Sec-Fetch-Site` must not
  say `cross-site`. The allowlist is built from `ALLOWED_ORIGINS` only —
  never from `Host`/`X-Forwarded-Host`, which a caller can forge to satisfy
  the check with its own pair.
- Honest limit: any non-browser client can forge these headers. This raises
  the cost of casual scripted abuse; it is **not** authentication.

**Prompt / model abuse**
- Both personas are told explicitly to treat user input as data, to refuse
  role changes, prompt disclosure, "debug mode" and credential requests.
- The kernel is told never to output credentials — even to the founder,
  because repeating them into a browser session leaks them.
- The transcript is client-supplied, so the model is told so directly and
  instructed that system rules always beat anything quoted in the history.
  Strict user/assistant alternation is enforced, capping how much fabricated
  history can be stuffed in.
- Monday briefs are injected as **fenced reference data** with angle brackets
  stripped, so a brief (which quotes repository text third parties can write)
  cannot close its own fence or issue instructions.

**Public/private boundary on the OS page**
- Only the hero and Layer 05 (the public demo chat) are in `os.html`'s
  published source. The kernel, agents, routines, memory, status board and
  briefs live in `docs/os-console.html`, which is bundled into the
  key-gated function and returns 404 as a static path.
- The public hero's boot log names no internal file paths.
- This is the important distinction: CSS/JS hiding is cosmetic — anyone can
  read the page source. Private content is only private if it never reaches
  an unauthenticated browser.

**The newer endpoints (`bi`, `project`, `lead`)**

These were written after the first hardening pass and initially **failed to
apply protections that already existed** in `_security.mjs` — the classic way
security regresses. Fixed 2026-08-23:

- All three check `FOUNDER_KEY` but none recorded failures or consulted the
  lockout, so the key could be brute-forced against them freely while `chat`
  and `console` were locked down. `lead`'s `list` action returns customer
  names, emails and messages — the most sensitive read in the system. All
  three now share the same 5-failures/15-minute lockout, verified by test:
  a correct key is still refused while the IP is locked.
- `bi`'s founder key only *raises rate limits*, so a wrong key degrades
  instead of refusing. Guessing is throttled anyway, and only when a key was
  actually supplied — anonymous users are never affected by someone else's
  lockout.
- `project`'s `event` action takes no ownership proof. It is now restricted to
  a fixed allowlist of event names and given its own 12/min bucket, so the
  analytics table cannot be inflated or used as free storage.
- The contact form gained a honeypot field plus a minimum time-to-submit.
  Both drop silently with a 200: a spammer told "rejected" adapts, one told
  "thank you" does not. Verified: bot submissions are not written to the
  database.

**Second review pass (independent threat model, 2026-08-23)**

An architect agent modelled the new surface and found more. Fixed:

- **The BI prompt fence was escapable.** `bi.mjs` reimplemented `chat.mjs`'s
  XML-ish fencing and dropped its sanitiser: the `prior` object's *keys* were
  interpolated raw into the tag, so a crafted key closed its own fence and
  injected instructions. With `plan` at 16 000 max tokens, that turned the
  endpoint into an unrestricted text generator printing under the Mwinda cover
  page. Now iterates a fixed stage allowlist and strips `[<>]` from values.
- **`create` was an unauthenticated, unbounded write.** The four `jsonb`
  columns passed a bare `typeof === "object"` check, so 512 KB bodies at
  40/min ≈ 20 MB/min per IP — enough to fill the 500 MB free tier in under
  half an hour and break the product for everyone. Oversized jsonb is now
  dropped (not truncated — half a blob is worse than none) and `create` has
  its own 6/min bucket, separate from `save`.
- **Only `idea` was length-capped on the endpoint that spends money.** Every
  other field rode in unbounded. All fields now clamp exactly as
  `project.mjs` already did — the cheap endpoint was stricter than the
  expensive one.
- **The cost ceiling counted requests, not tokens.** 600/h × 16 k tokens is
  ~9.6 M output tokens per warm instance. Replaced with an hourly *token*
  budget (`BI_TOKEN_BUDGET_HOURLY`, default 400 k) fed by the usage figures
  already returned, and `GLOBAL_RATE` cut to 200/h.
- **Successful privileged reads left no trace.** `lead.list` logged only
  failures, so a stolen key could dump the PII table repeatedly and generate
  zero evidence; `project` `save`/`load` logged nothing at all. All three now
  audit success.
- **Forged analytics.** Anyone could fire `dossier_exported` against a real
  project id. The client already holds the ownership token, so it now sends
  it; the server links the event only on proof.
- **`topic` leaked into `events`**, a table documented as personal-data-free.
  Removed — the lead row already has it.
- **Deny-by-default was per-table.** `alter default privileges … revoke all`
  added, so the next migration is not publicly readable by omission.
- **A shared access link permanently copied the dossier** into the recipient's
  browser and listed it in their saved-projects panel. Their token is now
  `sessionStorage`-scoped and shared projects are never listed.
- **Retention now exists** (`0002_retention.sql`): `purge_expired()` for leads
  at 18 months and events at 12, plus `erase_lead(email)` so a GDPR erasure
  request does not need hand-written SQL.

**The systemic finding, and the fix.** Twice an endpoint written after a
hardening pass re-solved a problem `_security.mjs` had already solved and lost
the protection doing it. The primitives were fine; nothing forced their use.
`_security.mjs` now opens with a six-point checklist for any new endpoint.

**Database (Supabase)**
- The browser holds **no Supabase credential**. All access is server-side
  through `project.mjs` / `lead.mjs` with the `service_role` key.
- RLS enabled on every table with **no policies**: `anon` and `authenticated`
  read nothing even if a key leaks. `service_role` bypasses RLS by design.
- BI projects are owned by an unguessable uuid **plus** a 32-byte capability
  token; only the token's SHA-256 is stored, so a database dump does not grant
  API access. Verified by test: forged token → 403, no content returned.
- The access link (`#p=<id>.<token>`) is a credential. The fragment never
  reaches the server, so it stays out of logs — but anyone holding the link
  holds the project.
- Storage is optional everywhere: unconfigured or unreachable Supabase returns
  501/503 and the client falls back to local storage. A database outage cannot
  take the site down.

**Browser / hosting**
- **CSP without `'unsafe-inline'` for scripts**: the 4 inline `<script>` blocks
  are allowed by SHA-256 hash. `scripts/update-csp.mjs` regenerates the policy;
  `--check` fails if it is stale. There are zero inline event handlers.
- `frame-ancestors 'self'` site-wide (blocks cross-origin clickjacking) and
  `'none'` + `X-Frame-Options: DENY` on `/os`, which holds the key input.
- `object-src 'none'`, `base-uri 'self'`, `form-action 'self' https://wa.me`,
  `upgrade-insecure-requests`, HSTS with preload, COOP/CORP `same-origin`,
  `X-Permitted-Cross-Domain-Policies: none`, tightened `Permissions-Policy`.
- Internal paths (`/docs/*`, `/scripts/*`, `/netlify/*`, `/.claude/*`,
  `CLAUDE.md`, `package*.json`, `DEPLOY-NETLIFY.md`, the zip) return a forced
  **404** in `netlify.toml` *and* `_redirects`.
- `style-src` keeps `'unsafe-inline'` deliberately: the pages use `style="..."`
  attributes, which hashes cannot cover, and there is no untrusted-CSS path.

**Verified not to be a problem** (checked, do not "fix"): the brief markdown
renderer escapes first and emits only attribute-free tags, so it has no XSS
path; `/brief` never takes a filename from the request; there is no CSRF
surface (no cookies, no ambient authority); the contact form has no server
leg, so no mail relay or injection surface exists.

### Database function grants — the PUBLIC trap

Postgres grants `EXECUTE` on every new function to `PUBLIC`. Revoking from
`anon` and `authenticated` does **not** remove that grant, and PostgREST honours
it: the function stays callable at `/rest/v1/rpc/<name>` by anyone holding the
anon key, which is public by design.

This was live on the production database. Before it was closed, any visitor
could call `erase_lead()` to delete a customer record, `purge_expired()` to
trigger mass deletion, or `refresh_reference_data()` to force seventeen
outbound API calls on demand.

The rule for every function added from now on:

```sql
revoke execute on function public.<name>(<args>) from public, anon, authenticated;
```

`alter default privileges in schema public revoke execute on functions from
public` is now set, so new functions no longer inherit the trap — but a
function created by a different role still can. Verify rather than assume:

```sql
select proname, has_function_privilege('anon', oid, 'EXECUTE')
from pg_proc where pronamespace = 'public'::regnamespace;
```

Supabase's own advisor flags this as *"Public Can Execute SECURITY DEFINER
Function"*. **Run the security advisor after any migration that adds a
function** — this one was caught by it, not by review.

## 3. Residual risks — ranked, with the honest verdict

| Risk | Status | Next step |
|---|---|---|
| **Rate limits are per warm instance.** Netlify autoscales, so N containers = N × the limits. | **Accepted, mitigated** by the global bucket and the spend cap | Move counters to Netlify Blobs for a shared limit |
| **The Anthropic spend cap is the only hard cost ceiling** and is set manually. | **Action required** | Set it in the console; treat it as the real control |
| **Forged assistant turns.** The transcript is client-supplied; alternation + prompt hardening reduce but do not eliminate the lever. | Mitigated, not solved | Sign each assistant reply (HMAC) and require it back |
| **No SRI on the CDN scripts** (Three.js, GSAP on `index.html`). | **Open** — hashes could not be computed offline | See runbook below; 5 minutes |
| **`FOUNDER_KEY` is a permanent bearer secret in `sessionStorage`**, auto-replayed to `/brief`. | Mitigated | Exchange it once for a short-lived `HttpOnly` cookie token |
| **Deny-list instead of allow-list for published files.** `publish = "."` uploads the whole repo; safety depends on remembering to add a rule. | Mitigated today, rots over time | Move public assets to `site/`, set `publish = "site"` |
| **Function logs have no retention or alerting.** | Open | Forward to a log drain with an alert on `auth_failed` bursts |
| **Blanket-overwrite saves, no revision history.** A link holder or a client bug can blank a dossier in one request; the free tier has no point-in-time recovery. | Accepted for the MVP | A `project_revisions` table, or paid-tier PITR |
| **`purge_expired()` must be scheduled.** The function exists; nothing calls it yet. | **Action required** | `pg_cron` if available, else a scheduled Netlify function |
| **PII to Meta.** The form hands name/email/message to WhatsApp with no notice. | Open (compliance, not security) | One line of disclosure by the submit button |

## 4. Runbook

**If the bill spikes or abuse is suspected — in this order:**
1. Netlify → Environment variables → set `CHAT_ENABLED=false` **and**
   `BI_ENABLED=false`. Both AI surfaces are off within a minute. Use them
   first, diagnose second. Removing `SUPABASE_URL` is the storage kill switch.
2. console.anthropic.com → check usage, lower the monthly cap.
3. Netlify → Functions → logs. Grep `chat.completed` and `bi.completed` for
   token totals, and `*.auth_failed` / `*.auth_locked_out` / `lead.bot_filtered`
   for abuse (`actor` is a stable pseudonymous hash of the IP — same attacker,
   same value). A burst of `auth_failed` across several endpoints from one
   actor is someone hunting for the founder key.

**If the founder key is exposed** (pasted, screenshotted, shared):
1. Netlify → change `FOUNDER_KEY` to a new value. The old one dies at the next
   deploy — there is no other revocation path, by design of a static secret.
2. Generate one with: `openssl rand -hex 16`.

**If the Anthropic key is exposed:** console.anthropic.com → create a new key →
update `ANTHROPIC_API_KEY` in Netlify → delete the old key. Do this in that
order so the site never has a dead key.

**Add SRI to the CDN scripts** (the one open item that needs a network):
```bash
for u in https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js \
         https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/gsap.min.js \
         https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/ScrollTrigger.min.js; do
  echo "$u  sha384-$(curl -sL "$u" | openssl dgst -sha384 -binary | openssl base64 -A)"
done
```
Then add `integrity="sha384-…" crossorigin="anonymous"` to each `<script>` tag
in `index.html`. Effect: a compromised CDN can no longer run code on the site.

**After editing any inline `<script>`:** run `node scripts/update-csp.mjs`,
or the browser will silently block it. `node scripts/update-csp.mjs --check`
fails when the policy is stale — wire it into any future CI.

## 5. Environment variables

| Variable | Required | Purpose |
|---|---|---|
| `ANTHROPIC_API_KEY` | yes | Model access. Never in code or chat. |
| `FOUNDER_KEY` | for `/os` + briefs | ≥ 16 chars, ≥ 8 distinct characters, or privileged mode refuses to run |
| `ALLOWED_ORIGINS` | recommended | Comma-separated hosts. Set when a custom domain is added. |
| `CHAT_ENABLED` | no | `false` = kill switch |
| `CHAT_MODEL` | no | Defaults to `claude-opus-4-8`; `claude-haiku-4-5` cuts cost ~5× |
| `SUPABASE_URL` | for storage | Supabase project URL. Removing it is the storage kill switch. |
| `SUPABASE_SERVICE_KEY` | for storage | `service_role` key — bypasses all database rules. Server-side only, never in a page. |
| `BI_ENABLED` | no | `false` = kill switch for AI Business Intelligence |
| `BI_MODEL` | no | Defaults to `claude-sonnet-5` |

Endpoints: `/.netlify/functions/chat` (public + founder mode) and
`/.netlify/functions/console` (founder only).

Report a vulnerability: see `/.well-known/security.txt`.
