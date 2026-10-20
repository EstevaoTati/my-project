# 2026-10-20 — Verified payments now, booking paused until MoMo is live

**Decision.** Apply the security hardening, PIN v7 and the verified-payments
fix (F-01) to production now, rather than with the MoMo launch. Founder's
go-ahead: "Tout autorisé ! Jusqu'à la fin".

**Why.** Before the fix, a client could mark a request paid by declaring a
reference; nothing checked with the operator. Production had no requests, so
fixing it now cost nothing in flight, whereas waiting would have meant
launching MoMo on top of a known critical flaw.

**What it means.**
- Only the `payment` Edge Function marks a request paid, after MTN or Airtel
  reports the collection successful, with the amount checked by
  `confirm_payment()`.
- Until the operator credentials are set as function secrets, the app shows
  "Le paiement en ligne ouvre bientôt…" and requests stay in draft.
- Card and bank transfer are not offered for online requests until a
  processor can confirm them server-side.

**Rejected.** Keeping client-declared payments with a manual "à vérifier"
label: it relies on someone checking every request by hand, and the
prestataire would still see unpaid jobs as paid.

**To reopen booking:** set the MTN/Airtel secrets (deployment checklist,
step 3). Before holding funds in escrow, confirm the legal position (R-11).
