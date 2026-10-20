# 242Konnect — residual risk register

Risks that remain after the 2026-10-20 hardening, with an owner decision for each.

| ID | Risk | Likelihood | Impact | Level | Treatment | Owner / next step |
|---|---|---|---|---|---|---|
| R-00 | ~~F-01: a client can declare a payment~~ **Closed 2026-10-20** | — | — | — | Verified payments applied; booking paused until operator credentials are set | Set MTN/Airtel secrets on the `payment` function to reopen booking |
| R-01 | Phone number not verified, so it can be squatted (UNIQUE) | Medium | Low | Medium | Accept until SMS verification exists | Product: SMS OTP, or drop UNIQUE on phone |
| R-02 | No MFA option for users (PIN is app-level) | Medium | Medium | Medium | Mitigated: PIN server-side, lockout, password in Auth | Supabase MFA (TOTP) when admin roles exist |
| R-03 | On the web, tokens are in localStorage, so readable by XSS | Low (strict CSP, no user HTML rendered) | High | Medium | CSP `script-src 'self'`; session revoked at sign-out | Native builds: SecureStore (`mobile.md`) |
| R-04 | `security_events` does not yet include Auth/PostgREST anomalies (failed logins, 403 bursts) | Medium | Medium | Medium | Supabase Auth logs exist in the dashboard | Log drain + alerting when on a paid plan |
| R-05 | API rate limits and token cache are in-process | Low (API not deployed) | Medium | Low | Documented | Redis before scaling to more than one worker |
| R-06 | ~~`search-providers` not in the repo, `!==` key compare~~ **Closed 2026-10-20** (v5: in the repo, constant-time compare, key ≥ 32 chars) | — | Low | Low | Public, approved listings only | Rotate `DIFY_SEARCH_TOKEN` if it was ever shared in chat or screenshots |
| R-07 | 23 npm advisories (16 high) in Expo/Metro build tooling, with no fixed version | Low (build time, not in the shipped bundle) | Medium | Low | CI blocks on critical; weekly Dependabot | Re-check at each Expo SDK upgrade |
| R-08 | Supabase project shared with Mwinda Digital | Medium | High | **High** | Separate RLS; no cross-grants | Move 242Konnect to its own project before launch |
| R-09 | Edge Functions deployed by hand, which caused the drift seen in F-02 | Medium | Medium | Medium | Repo is now authoritative; checklist | Deploy from CI with `supabase functions deploy` |
| R-10 | Device integrity (App Attest / Play Integrity) not implemented | Low | Medium | Low | Server never trusts the client anyway | Add when native apps ship to stores |
| R-11 | Escrow is a regulated activity in Congo | — | High | High | Not technical | Legal and payment-provider confirmation before holding funds |
| R-12 | Identity documents inline in profile JSON (F-16) | Medium | Medium | Medium | Size cap 2 MB | Private Storage bucket, then cap back to 20 KB |
| R-13 | A late Mobile Money confirmation is applied only when the payer's app asks again | Low | Medium | Low | Retrying with the same number finds the collection, no second debit; `payment.orphaned` flags the rest | Operator callback endpoint, or a scheduled sweep of pending collections, once MoMo is live |
