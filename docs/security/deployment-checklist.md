# 242Konnect — security deployment checklist

Nothing below has been applied to production yet. Each step that changes
production needs the founder's go-ahead.

## Step 1 — Database hardening migration (non-destructive)

`supabase/migrations/20261019120000_security_hardening.sql`

- [ ] Re-run the local replica tests:

      PGHOST=… bash supabase/tests/run-local.sh
      # expect 44 passed, 0 failed

- [ ] Apply in a quiet hour: Supabase MCP `apply_migration`, or the dashboard
      SQL editor. It takes brief locks on `profiles` and `provider_listings`
      (milliseconds on today's row counts).
- [ ] Re-run `supabase/tests/security_tests.sql` on production. It rolls back,
      so nothing is written. Every row must read `ok = true`.
- [ ] Re-run `242konnect-app/tools/verify-marketplace.sql`. Expect 25 rows,
      all `t`.
- [ ] Check the Security Advisor: the `rls_auto_enable` warnings should be gone.

**Rollback:** every change is additive.
- `drop trigger profiles_guard`, `enforce_quota`.
- Recreate the old listings policy: `using (true)`.
- Drop the new constraints.
- The new table and functions can stay.

## Step 2 — PIN function v7

**Prerequisite:** Step 1, which adds `pin_register_attempt` and
`security_events`.

- [ ] Deploy `supabase/functions/pin` (files `index.ts` and `core.ts`) with
      `verify_jwt = false`. Same as v6: the function validates the token
      itself.
- [ ] Smoke test with a real account:

      wrong PIN ×5      → 429 locked
      status            → lockedUntil set
      after 15 min      → right PIN works
      user_pin          → pin_hash now starts with pbkdf2$sha256$210000$

- [ ] Check that a real access token carries `amr` (decode it). The `reset`
      action depends on it.
- [ ] Wire "Code oublié ?" in the app to `action: "reset"` after the e-mail
      code. Until then, the action is only reachable from outside the app, and
      still needs a fresh code.

**Rollback:** redeploy v6. It ignores the new table.

## Step 3 — Verified payments (F-01) — needs a product decision

- [ ] Decide: apply now (booking pauses until MoMo is live), or with the MoMo
      launch.
- [ ] Run `PROPOSED=1 bash supabase/tests/run-local.sh`. Expect 7/7, plus 44/44.
- [ ] Move the file from `supabase/proposed/` to `supabase/migrations/` and
      apply it.
- [ ] Deploy the payment confirmation path: the API, or an Edge Function that
      receives the operator callback and calls `confirm_payment()` with the
      service role.

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
