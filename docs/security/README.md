# 242Konnect security

Audit, threat model, controls, tests and procedures for the 242Konnect backend.
Updated 2026-10-20, after the production rollout.

| Document | Contents |
|---|---|
| [assessment.md](assessment.md) | Inventory, data flows, trust boundaries, STRIDE threat model, findings F-01…F-16 with evidence |
| [policies.md](policies.md) | The ten security policies, how each is enforced and tested, standards mapping (ASVS, API Top 10, MASVS, NIST CSF) |
| [risk-register.md](risk-register.md) | Residual risks and the decision each needs |
| [deployment-checklist.md](deployment-checklist.md) | Ordered steps to put the controls in production, with rollback |
| [incident-response.md](incident-response.md) | Severity levels, playbook, secret rotation, backup and recovery (RPO/RTO) |
| [mobile.md](mobile.md) | Client-side controls, present and planned |

## Status of the controls

| Control | Status |
|---|---|
| DB hardening: function default-deny, profile guards, listing visibility, quotas, security log, persistent PIN lock state | **In production** since 2026-10-20 (nine parts). 44/44 on production, rolled back. |
| PIN function v7, with forgotten-PIN reset (step-up) | **In production** (version 7). Logic 17/17; app flow in the PIN log-in suite (22/22). |
| Verified payments (F-01, Critical) | **In production**: migration and `payment` function v1. 12/12 on production. Booking is paused until the MTN/Airtel secrets are set. |
| `search-providers` (R-06) | **In production** (v5): in the repo, constant-time key check. |
| API hardening: auth, BOLA, rate limits, CORS, body limit, headers, dependencies | **Implemented and tested** (47/47; pip-audit clean). The API is not deployed yet. |
| Sign-out revokes the session (F-11) | **Implemented** in the app; the PIN log-in suite checks it |
| CI security gate: secrets, DB tests, API tests, SCA, SAST, SBOM | **Implemented** (`.github/workflows/security.yml`); every step run locally first |
| Dashboard settings: leaked passwords, CAPTCHA, MFA for admins, Auth rate limits | **Pending external configuration** — checklist step 4 |
| Separate Supabase project for 242Konnect | **Recommended** (R-08) |

## Running the tests

The database tests run on a throwaway local PostgreSQL. They never touch
production.

```bash
# PostgreSQL 16 running locally, e.g. PGHOST=/tmp PGPORT=54329 PGUSER=postgres
bash supabase/tests/run-local.sh                                # hardened schema + payments: 56 checks
SKIP_MIGRATION=security_hardening bash supabase/tests/run-local.sh   # today's production: shows the 18 open flaws

cd 242konnect-api && python -m pytest -q                        # API incl. tests/test_security.py
node --experimental-strip-types supabase/functions/pin/core.test.mjs
node --experimental-strip-types supabase/functions/payment/operators.test.mjs
```

`supabase/tests/security_tests.sql` and `payment_tests.sql` can also be pasted into the production SQL
editor. Each runs inside a transaction that rolls back, so nothing persists.
