# 242Konnect — security deployment checklist

Steps 1–3 were applied to production on 2026-10-20, on the founder's
go-ahead ("Tout autorisé"). They are kept here as the record and as the
procedure for a rebuild. Steps 4–6 need access that the repository does not
have.

## Step 1 — Database hardening migration — **done 2026-10-20**

`supabase/migrations/20261019120000_security_hardening.sql`, applied in nine
parts (`security_hardening_0` … `_8`).

- [x] Local replica tests: 44/44.
- [x] Applied. Part 6 first failed on the 20 KB profile-details cap (identity
      documents stored inline, F-16); the cap is 2 MB.
- [x] `supabase/tests/security_tests.sql` on production, rolled back: 44/44.
- [x] Security Advisor: the `rls_auto_enable` warning is gone.

**Rollback:** every change is additive.
- `drop trigger profiles_guard`, `enforce_quota`.
- Recreate the old listings policy: `using (true)`.
- Drop the new constraints.
- The new table and functions can stay.

## Step 2 — PIN function v7 — **done 2026-10-20**

- [x] Deployed `supabase/functions/pin` (`index.ts`, `core.ts`),
      `verify_jwt = false`: version 7.
- [x] "Code oublié ?" in the app leads to the e-mail code, then to
      `action: "reset"` (PIN log-in suite 22/22).
- [ ] Smoke test with a real account (not possible from the build
      environment: supabase.co is unreachable from it):

      wrong PIN ×5      → 429 locked
      status            → lockedUntil set
      after 15 min      → right PIN works
      user_pin          → pin_hash now starts with pbkdf2$sha256$210000$

- [ ] Check that a real access token after an e-mail code carries `amr` with
      `otp` (decode it). If it does not, `reset` answers `step_up_required`
      and the person keeps signing in with e-mail codes.

**Rollback:** redeploy v6. It ignores the new table.

## Step 3 — Verified payments (F-01) — **done 2026-10-20**

- [x] `supabase/migrations/20261020000000_verified_payments.sql`, applied in
      three parts (`verified_payments_0` … `_2`). Production had no requests.
- [x] `payment_tests.sql` 12/12, `verify-marketplace.sql` 26/26 and
      `security_tests.sql` 44/44 on production, all rolled back, no residue.
- [x] `payment` Edge Function deployed (version 1, `verify_jwt = false`).
- [ ] **To reopen booking:** set the operator secrets on the `payment`
      function (dashboard → Edge Functions → Secrets, or
      `supabase secrets set`):
  - MTN: `MTN_MOMO_SUBSCRIPTION_KEY`, `MTN_MOMO_API_USER`, `MTN_MOMO_API_KEY`,
    `MTN_MOMO_ENVIRONMENT` (`sandbox` or the production target),
    `MTN_MOMO_BASE_URL` for production;
  - Airtel: `AIRTEL_CLIENT_ID`, `AIRTEL_CLIENT_SECRET`, `AIRTEL_ENVIRONMENT`,
    `AIRTEL_COUNTRY` (`CG`).
  - Test first with the sandbox credentials and a sandbox number.
- [ ] Optional: `PAYMENT_ALLOWED_ORIGIN` and `PIN_ALLOWED_ORIGIN` set to the
      app's domain.

**Rollback:** re-create `request_action` from
`20261001010000_marketplace.sql`. Not recommended: it reopens F-01.

## Step 3b — `search-providers` v5 (R-06) — **done 2026-10-20**

- [x] In the repo, constant-time key check, deployed as version 5.
- [ ] `DIFY_SEARCH_TOKEN` must be at least 32 characters, or the function
      answers 503. If Dify gets 503, set a new key:
      `openssl rand -base64 32`, in Supabase and in Dify.

## Step 3c — Prestataire workspace — **in progress 2026-10-21**

`supabase/migrations/20261021000000_provider_workspace.sql` (replica 87/87).

- [x] Parts 1–2 applied through the MCP (`provider_workspace_1`, `_2`):
      availability, open-request columns, `can_claim()`, request trigger.
      Additive; the current app is unaffected.
- [ ] Parts 3–5 (History, read receipts, conversations, message masking):
      the MCP no longer lets table creation through (the call times out and
      nothing reaches Postgres). **Founder:** Supabase dashboard → SQL
      Editor → paste `supabase/apply/2026-10-21_provider_workspace_parts_3-5.sql`
      → Run. The last line must read `true, true, 6, 1`.
- [ ] Then: production tests (rolled back), then the new Netlify packages.
      **Do not publish the new app before this step**: its Jobs and
      Messages need parts 3–5.

## Step 4 — Supabase dashboard settings

These can't be set from the repository.

- [ ] Authentication → Policies → **Leaked password protection: on** (F-14;
      Pro plan).
- [ ] Authentication → **Minimum password length 8**, with letters and digits.
- [ ] Authentication → Rate limits:
  - e-mails sent ≤ 30/h;
  - OTP verifications ≤ 30 per 5 min per IP;
  - token refreshes at the default.
- [ ] Authentication → **CAPTCHA (Cloudflare Turnstile or hCaptcha)** on
      sign-up and sign-in, against credential stuffing. The app must then
      send the token; this is a small client change.
- [ ] Authentication → Sessions: refresh token rotation **on**, reuse
      interval 10 s (the defaults).
- [ ] Email OTP expiry **600 s**.
- [ ] **MFA on every account** that can reach the Supabase organization,
      GitHub, Netlify and the domain registrar.
- [ ] Organization members: least privilege. "Developer" role for anyone who
      does not administer billing or keys.

## Step 5 — Repository and CI

- [ ] Merge the PR. The `security` workflow runs on every push.
- [ ] GitHub → Settings → Branches: protect the default branch. Require the
      `security` checks and one review.
- [ ] GitHub → Settings → Code security: enable **secret scanning and push
      protection**, and Dependabot alerts.
- [ ] Netlify: deploy previews for PRs only; production deploys only from the
      protected branch.

## Step 6 — API (only when it is deployed)

Required environment:

| Variable | Value |
|---|---|
| `APP_ENV` | `production` |
| `SUPABASE_URL` / `SUPABASE_ANON_KEY` | project values |
| `CORS_ORIGINS` | the exact web origins |
| `TRUST_PROXY` | `1` only behind a proxy that sets `X-Forwarded-For` |
| `OTP_PEPPER` | random 32 bytes |
| Operator keys | from MTN / Airtel |

- [ ] **Never** set `RATE_LIMIT_SCALE` or `CORS_ORIGINS=*` in production.
- [ ] Run one worker, or move the stores to Redis first (R-05).
