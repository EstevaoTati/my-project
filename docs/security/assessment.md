# 242Konnect — security assessment, threat model and findings

**Date:** 2026-10-19/20 · **Scope:** the 242Konnect backend (Supabase project
`abdmdtftnuyjzkdkcwiq`: database, Auth, Edge Functions), the FastAPI service
`242konnect-api/`, and the parts of the app (`242konnect-app/`) that touch them.
**Method:** live inventory of the project (read-only queries), code review,
STRIDE threat model, adversarial tests on a replica of the production schema.
No destructive action was taken against production, and no credential was rotated.

Each finding below is marked **verified** (shown by a test or a query) or
**suspected** (inferred, not demonstrated).

---

## 1. Architecture inventory

| Layer | What runs | Where |
|---|---|---|
| Client | React Native + Expo app, shipped as a web build (Netlify) and as native builds | untrusted device |
| Auth | Supabase Auth (GoTrue): e-mail OTP, then e-mail + password; access token (JWT, 1 h) + refresh token | Supabase |
| Data | PostgreSQL 17 behind PostgREST; RLS on every exposed table | Supabase |
| Server logic | `request_action()` state machine (SECURITY DEFINER), triggers that stamp server-owned fields | Supabase |
| Edge Functions | `pin` (v6 live, v7 in repo), `search-providers` (Dify integration, not in repo), `refresh-reference` (Mwinda Digital, other product) | Supabase |
| API | FastAPI: e-mail OTP (fallback provider) and MTN/Airtel Mobile Money collections | **not deployed**; production uses Supabase for OTP |
| Hosting | Netlify (static web build) | Netlify |
| Third parties | Supabase, Netlify, SMTP provider (via Supabase), MTN MoMo and Airtel Money APIs (sandbox), Dify (calls `search-providers`) | external |

### Sensitive data and where it lives

| Data | Location | Protection |
|---|---|---|
| Passwords | `auth.users` (bcrypt, Supabase) | never readable through the API |
| Legacy password hashes (salted SHA-256) | device storage, accounts created before 2026-10-02 | device only (F-12) |
| PIN hashes (PBKDF2) | `public.user_pin` | RLS on, no policy, no grant: service role only |
| PIN lock state | `public.user_pin_security` | same |
| Identity: name, phone, e-mail, city, photo | `public.profiles` | RLS: own row only |
| Exact client address | `public.service_request_private` | client always; prestataire only once the request is accepted |
| Messages | `public.request_messages` | the two parties only |
| Consents (IP address, user agent) | `public.consent_records` | own rows only; append-only; stamped server-side |
| Session tokens | device storage (localStorage on the web) | F-11 |
| Security events | `public.security_events` (new) | service role only, append-only |

### Trust boundaries

1. **Device ↔ Supabase.** Everything the app sends is untrusted. The publishable
   key is public by design. Identity comes only from a validated JWT.
2. **PostgREST ↔ SECURITY DEFINER functions.** These run with the owner's
   rights, so each one must check the caller itself.
3. **Edge Function ↔ service role.** The `pin` function holds the service-role
   key. Anything it does on a user's behalf must be scoped to the user it
   resolved from the token.
4. **Payment service ↔ operators.** Only an operator's confirmation may prove
   that money moved (F-01).
5. **Supabase project shared with another product.** Mwinda Digital's tables
   and functions live in the same project (F-13).

---

## 2. Threat model (STRIDE)

| | Threat | Where | Control in place after this work | Residual |
|---|---|---|---|---|
| **S**poofing | Using someone else's account | Auth | Supabase Auth; e-mail OTP at sign-up; password at sign-in; PIN to reopen | No MFA option (R-02) |
| | Claiming another identity in a row | profiles, requests, messages, consents | Triggers force `client_id` / `sender_id` / `user_id` from `auth.uid()`; `email` forced from the JWT (F-04) | — |
| | Guessing a PIN | `pin` function | Persistent lock: 5 tries, 15 min; 24 h after 3 locks (F-03) | Live once v7 is deployed |
| **T**ampering | Marking a request as paid | `request_action('pay')` | **Open — F-01**, fix proposed | Critical until decided |
| | Self-approving a listing, self-verifying | provider_listings, profiles | Column grants exclude `status`; trigger keeps `prestataire.verified` (F-04) | — |
| | Rewriting the audit trail | consent_records, security_events | Insert-only grants; append-only trigger | — |
| **R**epudiation | "I never accepted that contract" | consent_records | Server timestamp, IP and user agent; append-only | — |
| | No trace of an attack | everywhere | `security_events` (PIN, payments) | Not yet fed by Auth or PostgREST logs (R-04) |
| **I**nformation disclosure | Reading other accounts | all tables | RLS own-row policies, tested as three users | — |
| | Pending or refused providers, refusal reasons | provider_listings | Others see approved listings only (F-05) | — |
| | Client address before acceptance | service_request_private | Policy tied to request status | — |
| | Stack traces, internals | API | Generic 500 handler; docs off in production | — |
| **D**enial of service | Floods of requests, messages, OTP mails, MoMo prompts | DB, API | Per-user DB quotas (F-07); API rate limits (F-15) | Supabase Auth limits are dashboard settings (deployment checklist, step 4) |
| | Oversized payloads | DB, API, `pin` | CHECK constraints; 16 KB API body limit; 2 KB on `pin` | — |
| **E**levation of privilege | Calling privileged functions over RPC | public schema | Execute revoked; default privileges deny (F-08) | — |
| | Session left on a signed-out device | app | Revoked and deleted at sign-out (F-11) | Web storage is still readable by XSS (R-03) |

---

## 3. Findings

Severities: Critical, High, Medium, Low.

### F-01 · Critical · verified — A client can declare its own payment

`request_action(id, 'pay', {method, payment_ref})` moves a draft to `sent` on
the client's word alone. Nothing checks with the operator that money moved,
nor that the amount matches. The prestataire then sees a paid job.
`verify-marketplace.sql` ("A pays once") shows it working.

- **Impact:** fake paid jobs today. The day escrow goes live, theft of service.
- **Fix (prepared, not applied):** `supabase/proposed/20261020000000_verified_payments.sql`.
  - The client's `pay` action is removed.
  - Only the service role can call `confirm_payment()`, and only for the exact amount.
  - A mismatch is logged, not raised, so the evidence survives.
  - The prestataire cannot accept an unverified payment.
  - 7/7 tests pass: `PROPOSED=1 bash supabase/tests/run-local.sh`.
- **Why it waits:** it switches booking off until a payment backend with
  operator credentials is deployed. That is a product decision.
- **Interim option:** apply it now, and label requests as "paiement à vérifier"
  manually until MoMo goes live.

### F-02 · High · verified — Production differs from the repository

Three migrations were applied live but never committed. The live `pin`
function (v6) is not the repo's version. `search-providers` exists only in
production. So the code that runs could not be rebuilt or reviewed from the
repo.

- **Fix:** the three migrations are now committed. Function definitions,
  policies and grants were compared object by object: a replica built from the
  repo matches production on all 37 security objects (§4). `pin` v7 replaces
  both versions. `search-providers` is listed in R-06.

### F-03 · High · verified — The PIN lockout could be bypassed

v6 counts wrong PINs in the memory of one Edge Function instance. Another
instance, or a cold start, begins again at zero. The `user_pin_security` table
built for this was never used (0 rows).

- **Fix:** `pin_register_attempt()` updates the count and the lock atomically
  in the database. Escalation: 24 h after three locks in a day.
- **PIN function v7:**
  - uses it;
  - re-hashes v6 rows from 120k to 210k PBKDF2 rounds;
  - counts wrong *current* PINs on a change too;
  - logs events.
- **Tests:** 4 SQL tests, plus the PIN core logic at 17/17.
- **Status:** the database side is ready; v7 deployment is pending approval.

### F-04 · Medium · verified — Server-owned profile fields were client-writable

An account could:
- write any e-mail into its row, reserving another person's address, since
  e-mail is UNIQUE platform-wide;
- set `prestataire.verified = true`;
- change `created_at`.

- **Fix:** trigger `profiles_guard`. Tests: 4.
- **Residual:** the phone number cannot be verified (no SMS), so it can still
  be squatted (R-01).

### F-05 · Medium · verified — Every signed-in user could read every listing

This included pending and refused profiles and the refusal reason.

- **Fix:** policy "approved, or your own". The refusal reason is cleared on
  approval. Tests: 4.
- **App impact:** none. Clients never needed non-approved listings, because
  `service_request_prepare()` already refuses to book them.

### F-06 · Medium · verified — The API was open

`242konnect-api` is not deployed, but would have been unsafe if it were:
- no authentication on the Mobile Money endpoints, so anyone could trigger PIN
  prompts on any phone;
- any collection was readable by id (BOLA);
- idempotency keys were shared across users;
- `CORS=*` by default;
- no body limit, no security headers;
- e-mail addresses in logs;
- starlette 0.41.3 with 7 published advisories.

- **Fix:**
  - Supabase-token authentication that fails closed.
  - Owner checks; per-user idempotency keys.
  - Explicit CORS (`*` refused in production).
  - 16 KB body limit, security headers, generic 500.
  - Unknown fields rejected; masked logs.
  - fastapi 0.150 / starlette 1.9.
- **Tests:** 16 new security tests; 47/47 in total. pip-audit: 0 known
  vulnerabilities.

### F-07 · Medium · verified — No quotas

One account could create requests, messages, consents or data requests without
limit.

- **Fix:** per-user DB quotas:

  | What | Limit |
  |---|---|
  | Requests | 20 per hour |
  | Messages | 20 per minute |
  | Consents | 60 per day |
  | Data requests | 5 per day |

- **Tests:** 2.

### F-08 · Low · verified — `rls_auto_enable()` executable by anon

It is SECURITY DEFINER and executable by anon and authenticated. It is not
exploitable: it is an event trigger, and calling it fails. But the default
privileges would expose the next function created the same way.

- **Fix:** execute revoked. Default privileges now deny EXECUTE to anon and
  authenticated. Tests: 7.

### F-09 · Medium · verified — No security log

- **Fix:** `security_events`:
  - append-only, even for the owner (trigger);
  - service role only;
  - kept 400 days, purged daily by pg_cron.
- **Fed by:** PIN events and payment confirmations.

### F-10 · Low · verified — No size or format limits on profiles

- **Fix:** CHECK constraints on name, e-mail, phone format, place, bio, JSON
  size and avatar. Images only: no `javascript:`, no `data:text/html`.
- **Tests:** 2. Existing production data was checked against every rule
  beforehand: 0 violations.

### F-11 · Medium · verified — A valid session survived sign-out

After sign-out, the refresh token stayed in device storage (localStorage on
the web). It works directly against PostgREST, and the PIN only guards the
app's screens.

- **Fix:** sign-out revokes the session (`/auth/v1/logout`) and deletes it.
- **Test:** `verify-pin-login` asserts the revocation.

### F-12 · Low · suspected — Legacy password hashes on devices

Accounts migrated before 2026-10-02 keep a salted SHA-256 password hash in
device storage, for the migration path. SHA-256 is fast to brute-force if the
storage is copied.

- **Plan:** remove the local hash after migration has run for the active
  accounts.

### F-13 · Medium · verified — Supabase project shared with another product

Mwinda Digital's `leads`, `projects`, `reference_*` tables and the
`refresh-reference` function share the project, its service-role key and its
admin access with 242Konnect. A compromise or a mistake on one side reaches
the other.

- **Recommendation:** move 242Konnect to its own Supabase project before
  launch (R-08).

### F-14 · Low · verified — Leaked-password protection off in Supabase Auth

This is the Supabase advisor's finding. It is a dashboard setting (deployment checklist, step 4).

### F-15 · Medium · verified — No rate limits on the API

- **Fix:** per address and per subject:

  | Endpoint | Limit |
  |---|---|
  | OTP send | 10 per IP / 10 min, 5 per e-mail / hour |
  | OTP check | 30 per IP / 10 min |
  | MoMo prompt | 10 per user / 10 min |

- **Note:** the limits are in-process, so they hold for one worker only (R-05).

### Reviewed and found correct

- `user_pin` and `user_pin_security`: RLS on, no policy, no grant.
- The `pin` function resolves the user from the token through `auth.getUser`.
  This also rejects revoked sessions.
- `request_action()` checks the caller is a party before anything else. A
  stranger gets "request not found", the same answer as for an unknown id.
- The consent and data-request triggers stamp `user_id`, time and IP
  server-side.
- The client address is hidden from the prestataire until acceptance
  (marketplace tests).
- The receipt HTML escapes every user value. Semgrep's
  `html-in-template-string` alert is a false positive.
- **Secrets:** gitleaks found no secret in 83 commits or in the working tree.
  The only key in the bundle is the publishable key.

---

## 4. Evidence

| Check | Result |
|---|---|
| DB security tests on a replica of production, with the hardening | **44/44** |
| Same tests without the hardening migration (proves they detect the flaws) | 23 pass, **18 fail** — the vulnerabilities above |
| Replica fidelity: functions, policies, table and column grants vs production | 37/37 identical (3 functions differ only in comments/whitespace) |
| Existing marketplace rules on the hardened replica | 25/25 |
| Proposed verified payments (F-01) | 7/7 |
| PIN core logic (hashing, v6 rows, step-up) | 17/17 · `deno check` clean |
| API tests (31 existing + 16 security) | 47/47 |
| pip-audit (API) | 0 known vulnerabilities |
| npm audit (app) | 34 → 23 after non-breaking fixes; critical 1 → 0 (R-07) |
| gitleaks: full history and working tree | 0 leaks |
| Semgrep (TypeScript, JavaScript, Python, secrets; 221 rules), ERROR level | 0 |
| App end-to-end suites after the changes | see the commit message |

### Pre-flight against production data (read-only)

- 11 profiles: 0 e-mail mismatches with Auth; 0 invalid phones.
- Longest avatar: 23 KB, all with a valid prefix.
- 0 self-verified profiles.
- 3 listings, all pending: they will be visible to their owners only until
  approved, as the specification requires.
- 10 PIN hashes, all in v6 format, all supported by v7.

### What could not be tested here

- The `pin` v7 HTTP path against the real Auth server. It needs a deploy and a
  real token; a smoke test is in the deployment checklist.
- Whether GoTrue's access token carries the `amr` claim that v7's reset uses.
  This must be checked on a real token before relying on it.
- Supabase dashboard settings (Auth rate limits, CAPTCHA, leaked-password
  check, MFA on the dashboard accounts). They are not readable through the
  tools available here.
