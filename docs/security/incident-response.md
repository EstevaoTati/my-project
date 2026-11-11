# 242Konnect — incident response, recovery and secret rotation

## Severity

| Level | Examples | Response |
|---|---|---|
| **SEV-1** | Service-role key leaked; mass data exposure; money moved fraudulently | Immediately, day or night. Founder decides on user notification within 24 h. |
| **SEV-2** | One account taken over; payment amount mismatch (`payment.amount_mismatch`); a policy found too open | Same day |
| **SEV-3** | Repeated PIN locks on one account; rate limits hit; suspicious sign-ups | Next working day |

## Playbook

1. **Detect.**
   - `security_events`: query in the dashboard SQL editor.
   - Supabase Auth logs; Netlify logs.
   - Users' reports.
   - CI alerts.
2. **Triage.** What is affected, since when, and is it still happening? Assign a
   severity level.
3. **Preserve evidence before changing anything:**
   - export the relevant `security_events` rows and Auth logs;
   - note the timestamps;
   - never delete logs (the table is append-only by design).
4. **Contain** (the smallest action that stops the harm):

   | Situation | Action |
   |---|---|
   | One account | Dashboard → Authentication → user → **sign out / ban user**. This revokes refresh tokens; access tokens expire within 1 h. |
   | Service-role key leaked | **Rotate the JWT secret / API keys** (below). This signs everyone out. |
   | A policy too open | Apply a migration that tightens it. Run `bash supabase/tests/run-local.sh` first. |
   | Edge Function compromised | Redeploy the repo version, or delete the function. |
   | Payments | Pause booking by unsetting the MTN/Airtel secrets on the `payment` function (`supabase secrets unset …`): it then answers `payments_unavailable`. Collections already started are kept in `payment_collections`. |

5. **Root cause.** Reproduce it in a test on the local replica, so that it can
   never come back silently.
6. **Remediate.** Fix it, add the regression test, and deploy through the
   checklist.
7. **Recover.**
   - Restore data if needed (below).
   - Re-enable what was paused.
   - Watch `security_events` for 72 h.
8. **Notify.** Affected users; the payment provider if money is involved.
   Check local data-protection law with counsel (Congo: law 29-2019).
9. **Review within 7 days.** Write up the timeline, the cause and what changed.
   File it in `docs/decisions/`.

## Secret rotation (emergency and routine)

| Secret | Where it lives | How to rotate | Effect |
|---|---|---|---|
| Supabase JWT secret / API keys | Supabase dashboard | Settings → API → rotate. Then update `EXPO_PUBLIC_SUPABASE_ANON_KEY` in `242konnect-app/.env`, rebuild, redeploy Netlify. | All sessions end. The old app build stops working. |
| Service-role key | Edge Function env (automatic) | Rotated with the above | Functions keep working (env refreshed) |
| `DIFY_SEARCH_TOKEN` | Edge Function secrets | `supabase secrets set DIFY_SEARCH_TOKEN=…`, then update Dify | Dify search pauses until updated |
| MTN / Airtel credentials | API host environment (when deployed) | Operator portal, then the host env | Payments pause until updated |
| SMTP password | Supabase Auth → SMTP settings | Provider portal, then Supabase | OTP mails pause briefly |
| Netlify / GitHub tokens | Accounts | Revoke and recreate; MFA must be on | — |

Routine: rotate operator and SMTP credentials yearly, and when anyone with
access leaves.

## Backup and recovery

| Item | Mechanism | RPO | RTO |
|---|---|---|---|
| Database | Supabase daily backups (7 days on Pro). Point-in-time recovery is an add-on. | 24 h (PITR: minutes) | 1–4 h |
| Schema and policies | `supabase/migrations/` in git, verified against production (assessment §4) | 0 | < 1 h on a new project |
| Edge Functions | `supabase/functions/` in git (`pin`, `payment`, `search-providers`) | 0 | < 30 min |
| Web app | Netlify deploys + `242konnect-netlify-package*.zip` in git | 0 | < 15 min |
| Auth users | Part of the database backup | as DB | as DB |

**Restore drill (to schedule quarterly):**

1. Restore the latest backup into a new Supabase project.
2. Run `security_tests.sql` and `verify-marketplace.sql` against it.
3. Record the time taken. If it beats the RTO, the backup is good.
