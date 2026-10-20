# 242Konnect — security policies and how each is enforced

A policy counts as **technical** only if a machine refuses the violation and a
test proves it. A **procedural** policy depends on people following a
procedure, and is marked so.

| # | Policy | Enforcement | Type | Test | Failure behaviour |
|---|---|---|---|---|---|
| 01 | **Default deny** — nothing is accessible unless explicitly authorized | RLS on every exposed table. Tables are granted to nobody by default. EXECUTE on new functions is denied to anon and authenticated by default (migration 20261019120000). API routes return 401 without a valid token. | Technical | `security_tests.sql` (anon reads nothing, cannot call functions); `test_payments_require_a_token` | Request refused (401/403/permission denied) |
| 02 | **Least privilege** — each identity has only what it needs | Column-level grants: `status` and `refusal_reason` are not writable by users. Privileged functions run as the service role only. Service-role key only in Edge Function secrets. | Technical | "B cannot self-approve"; "A cannot call pin_register_attempt" | Permission denied |
| 03 | **Server-side authorization** — the client decides nothing | Owner and status fields stamped by triggers from `auth.uid()`/JWT. State changes only through `request_action()`. Payments confirmed by the service role (F-01, proposed). | Technical (F-01 pending) | Mass-assignment tests; marketplace rules | Value overwritten, or refused |
| 04 | **Data isolation** — no user reads or changes another's private data | Own-row RLS. Party-only policies on requests, messages, addresses. Owner check on API collections. | Technical | "A cannot update B's profile", "C cannot see A's request", "another user's collection looks unknown" | Empty result or 404, never someone else's data |
| 05 | **Strong authentication** — stronger for privileged access | Users: e-mail OTP at sign-up, password (bcrypt, Supabase), server-checked PIN with persistent lockout. PIN reset needs a fresh e-mail code (v7). **Admins (Supabase dashboard, GitHub, Netlify): MFA required.** | Users technical; admins **procedural** | PIN lock tests; core.test.mjs step-up | Locked or refused |
| 06 | **Encryption** — in transit and at rest | TLS everywhere: Supabase, Netlify (HSTS preload), API (HSTS header). Supabase encrypts storage and backups at rest. PINs: PBKDF2 210k. Passwords: bcrypt. | Technical (platform) | Headers test; Supabase defaults | Plain HTTP not served |
| 07 | **Secret protection** — no secret in a client or the repo | Only the publishable key in the bundle. Service-role and operator keys only in server environments. gitleaks on every push. | Technical | `secrets` CI job (0 leaks over the full history) | CI red; push flagged |
| 08 | **Security monitoring** — security events are logged and reviewed | `security_events` (append-only, 400 days). API logs without tokens or full e-mails. **Weekly review of `high` events.** | Logging technical; review **procedural** | Append-only test; lock-logged test | Event recorded even when the request fails (payments) |
| 09 | **Secure deployment** — security checks are part of the release | `.github/workflows/security.yml`: secrets, DB tests, API tests, pip-audit, npm audit (critical), Semgrep, SBOM. **Production changes (migrations, Edge Functions, dashboard) need founder approval.** | CI technical; approval **procedural** | The workflow itself | Red check; no merge (branch protection to enable — deployment checklist) |
| 10 | **Incident readiness** — investigate, contain, recover, notify | `incident-response.md`: severity levels, revocation and rotation steps, evidence kept, backups. | **Procedural** | Restore drill (to schedule) | — |

## Standards mapping (main controls)

| Control | OWASP ASVS 4 | OWASP API Top 10 (2023) | MASVS 2 | NIST CSF 2.0 |
|---|---|---|---|---|
| RLS own-row, party-only policies | V4.1, V4.2 | API1 BOLA | — | PR.AA-05 |
| Server-owned fields (triggers, column grants) | V4.2.1, V5.1.3 | API3 Property-level authorization | — | PR.AA-05 |
| `request_action()` state machine, F-01 fix | V11.1 business logic | API6 Sensitive business flows | — | PR.PS-06 |
| Function default-deny, revoked EXECUTE | V4.1.3 | API5 Function-level authorization | — | PR.AA-05 |
| PIN: server-side check, persistent lockout, PBKDF2 | V2.2.1, V2.4 | API2 Broken authentication | MASVS-AUTH-2 | PR.AA-03 |
| Step-up for PIN reset | V2.5, V3.7 | API2 | MASVS-AUTH-3 | PR.AA-03 |
| Session revoked at sign-out | V3.3.1 | API2 | MASVS-AUTH-1 | PR.AA-03 |
| DB quotas, API rate limits, body limits | V11.1.4, V13.1 | API4 Unrestricted resource consumption | — | PR.IR-04 |
| Input constraints (CHECKs, pydantic `extra=forbid`, patterns) | V5.1 | API3, API8 | MASVS-CODE-4 | PR.PS-06 |
| Security headers, CORS allow-list, no docs in production | V14.4, V14.5 | API8 Security misconfiguration | — | PR.PS-01 |
| `security_events` | V7.1, V7.2 | API10 (logging) | — | DE.CM-01, DE.AE-03 |
| Secret scanning, SCA, SAST, SBOM in CI | V14.2, V1.14 | API9 Inventory | MASVS-CODE-3 | ID.RA-01, PR.PS-02 |
| Repo == production reconciliation (F-02) | V14.1 | API9 Improper inventory management | — | ID.AM-08 |
