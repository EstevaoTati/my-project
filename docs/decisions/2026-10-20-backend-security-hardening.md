# 242Konnect — backend security hardening

**Date:** 2026-10-20 · **Asked by:** founder ("Dans le backend, renforce la security de l'app", with the zero-trust security brief)

## Decision

1. **Audit first, then fix verified findings only.** 15 findings: 1 Critical,
   2 High, 8 Medium, 4 Low. Each is shown by a test or a query, not assumed
   (`docs/security/assessment.md`).
2. **Never test schema changes against production, even rolled back.** A
   rolled-back trial on production timed out after 60 s. It was confirmed
   fully rolled back, with no lingering locks, but DDL takes table locks that
   can stall live users. From then on, everything ran on a local PostgreSQL
   replica, proven identical to production on 37/37 security objects.
3. **Ship the non-breaking controls; hold the flow-changing one.**
   - Ready to deploy with approval: the hardening migration, PIN v7, the API.
   - Waits for a product decision: the payment fix (F-01, Critical), because
     it pauses booking until Mobile Money is live.
4. **The repository is the source of truth.** The three live-only migrations
   were committed. `pin` v7 replaces both the repo and the live v6 versions.
   CI blocks regressions.
5. **Dashboard settings, MFA for admins and a separate Supabase project are
   recommendations.** They cannot be enforced from code.

## Rejected

- **Treating device attestation or root detection as trust.** These are risk
  signals only (`docs/security/mobile.md`).
- **Claiming "unhackable".** The goal is prevention, detection, containment
  and recovery, with evidence for each.
