# 242Konnect security

Audit, threat model, controls, tests and procedures for the 242Konnect backend.
Updated 2026-10-20.

| Document | Contents |
|---|---|
| [assessment.md](assessment.md) | Inventory, data flows, trust boundaries, STRIDE threat model, findings F-01…F-15 with evidence |
| [policies.md](policies.md) | The ten security policies, how each is enforced and tested, standards mapping (ASVS, API Top 10, MASVS, NIST CSF) |
| [risk-register.md](risk-register.md) | Residual risks and the decision each needs |
| [deployment-checklist.md](deployment-checklist.md) | Ordered steps to put the controls in production, with rollback |
| [incident-response.md](incident-response.md) | Severity levels, playbook, secret rotation, backup and recovery (RPO/RTO) |
| [mobile.md](mobile.md) | Client-side controls, present and planned |

## Status of the controls

| Control | Status |
|---|---|
| DB hardening: function default-deny, profile guards, listing visibility, quotas, security log, persistent PIN lock state | **Implemented and tested** (44/44 on a replica of production). **Not yet applied to production** — step 1 of the checklist. |
| PIN function v7 | **Implemented** (logic 17/17, type-checked). **Deployment pending approval.** |
| Verified payments (F-01, Critical) | **Prepared and tested** (7/7). **Awaiting product decision.** |
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
bash supabase/tests/run-local.sh                                # hardened schema: 44 checks
SKIP_MIGRATION=security_hardening bash supabase/tests/run-local.sh   # today's production: shows the 18 open flaws
PROPOSED=1 bash supabase/tests/run-local.sh                     # plus the proposed payment fix

cd 242konnect-api && python -m pytest -q                        # API incl. tests/test_security.py
node --experimental-strip-types supabase/functions/pin/core.test.mjs
```

`supabase/tests/security_tests.sql` can also be pasted into the production SQL
editor. It runs inside a transaction that rolls back, so nothing persists.
