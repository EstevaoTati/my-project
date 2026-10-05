# 242Konnect — cahier des charges vs. what exists

**Date:** 2026-08-18
**Sources:** `CAHIER_DE_CHARGE_242KONNECT_APP.pdf` (v1.0, 7 juillet 2026, 44 p.),
`DIRECTIVES_GENERALES_242APP.pdf` (5 p.)
**Status:** in progress — this file records what changed, what is deliberately
not built yet, and why.

---

## The headline

The two documents describe a **platform**, not an application. Four spaces
(Particulier, Prestataire, Business, Administration), FastAPI + PostgreSQL on
AWS, OTP by SMS, escrow payments with a 12 % commission, geolocation, an AI
assistant, push/SMS/email notifications and device management.

What exists in this repo is the **client-side Particulier app**, running with no
backend at all. That is roughly the front half of Phase 1 (MVP) in §12.2.

The important consequence: **most of the remaining spec cannot be built on the
client at all.** It is not a matter of effort — OTP by SMS needs an SMS gateway,
escrow needs a payment provider and a ledger, "un compte ne peut être connecté
sur plus de 4 appareils" needs a server that can see all the devices. Building
convincing-looking versions of these on the phone would be worse than not
building them, because it would look finished when nothing is enforced.

---

## Corrected in this pass

These were direct contradictions between the app and the documents, not gaps.

| Item | Was | Now |
|---|---|---|
| **Palette** | Green / yellow / red from the Sleek export | Black, grey, yellow accent (Directives, "Couleurs principales") |
| **Typography** | Outfit + Plus Jakarta Sans | Manrope SemiBold titles, Inter Regular text, Inter Medium buttons |
| **Splash** | None — app opened straight onto Bienvenue | Wordmark revealed letter by letter on black with a glow, held, faded; ~2.2 s |
| **Launch routing** | Always Bienvenue | First open → Commencer; later opens → dashboard if signed in, else Connexion |
| **Commencer screen** | Two options | Three, per the directives: Créer un compte, Se connecter, **Découvrir 242Konnect** |
| **Catalogue** | 10 invented categories, 38 métiers | The 15 categories and ~110 métiers listed in §4.3 |

On the palette: yellow is specified as the **accent**, so black carries primary
actions and yellow is reserved for highlights and selected states. Spending the
yellow on every surface would leave nothing to draw the eye — and the platforms
the directives name as references (Uber, Airbnb, Stripe) all work this way.
One real bug fell out of the change: on the black Commencer screen a black
primary button was invisible, so that CTA is yellow.

The 8 category icons the spec needs and the Sleek export never shipped are drawn
in-house and namespaced `242k:` — the Iconify API is unreachable from the build
environment, and mislabelling them as Solar would be wrong.

---

## Buildable on the client, not yet done

Ordered by how much of the rest depends on them.

1. **One account, several profiles** (§9.10). One phone + one email, with
   Particulier / Prestataire / Business activated on top and a profile switcher.
   Today the app has a single role chosen at sign-up. The spec is explicit that
   three separate accounts is the wrong shape.
2. **OTP verification** (§3.2, §9.1). The flow, the screen and the
   6-digit entry can exist now; only the delivery needs a gateway.
3. **Account uniqueness** (§9.10), including the exact refusal message the
   spec dictates.
4. **Escrow payment model** (§5.8, §6.5–6.6). Client pays 242Konnect *before*
   the service; funds held until validation; 12 % commission; payout standard at
   7 days (1.25 %) or express (4 %). The app currently takes a flat payment with
   no commission and no hold. **The rule that no money ever goes directly to the
   prestataire is a hard rule in the spec and belongs in the UI.**
5. **Full booking request** (§5.2): description, up to 10 photos, address, date,
   time, budget, urgency, special instructions. Today it is a slot picker.
6. **Mission lifecycle** (§5.3–5.7): proposals, negotiation, accept/refuse,
   started/in-progress/finished, client validation or correction request.
7. **Score 242K and badges** (§7.4–7.6). Criteria are listed; the score can be
   computed client-side from local data as a placeholder.
8. **Reviews** (§7.3, §7.9), including the confirmation message quoted verbatim
   in the spec, and the rule that detailed comments are **not public**.
9. **Devices list and connection log** (§9.9) — displayable now, enforceable
   only server-side.

---

## Blocked on a backend — do not fake these

| Requirement | Why it cannot be done client-side |
|---|---|
| OTP by SMS / e-mail (§3.2) | Needs an SMS/e-mail gateway |
| Escrow, commission, payouts (§6) | Needs a payment provider, a merchant account and a ledger |
| Uniqueness of phone/e-mail across users (§9.10) | Can only be checked against a shared database |
| Max 4 devices, remote sign-out (§9.9, §10.7) | The device list has to live somewhere both devices can see |
| Geolocation, distance, live tracking (§3.5, §9.3) | Needs Maps APIs and prestataire position updates |
| Push / SMS / e-mail notifications (§3.3) | Needs FCM and a sending service |
| 242K.Assistant (§8) | Needs a model endpoint; no offline substitute is honest |
| Espace Prestataire / Business / Admin (§2.2) | Each needs server-side data and roles |
| Document validation, "Prestataire vérifié" (§7.6) | A human review workflow |

The stack the spec fixes — Python/FastAPI, PostgreSQL, AWS S3, AWS, REST, JWT
(§11.2) — is a separate build. Nothing in the current app blocks it: the client
already isolates its storage behind a few functions.

---

## Recommended sequencing

**Now (client, no backend):** items 1–4 above. They are the ones that change the
product's shape, so building them late means reworking screens twice. Payments
and OTP get a visible, honest "démonstration" marker until a provider is wired.

**Next (backend, Phase 1 of §12.2):** FastAPI + PostgreSQL, auth with JWT and
OTP, accounts and profiles, catalogue, demandes, and the payment integration.
This is the point at which the app stops being a device-local prototype.

**Then:** Espace Prestataire, then Business, then Admin — in that order, because
a marketplace with no supply side cannot be tested with real users.

## Risks worth stating

- **Escrow is a regulated activity.** Holding client funds until validation, and
  paying out with commission, has legal and licensing implications in the Congo.
  Confirm the arrangement with the payment provider and a lawyer before building
  it, not after.
- **The 12 % commission plus 1.25 %/4 % payout fees** are stated in the spec but
  the model's viability against Mobile Money's own transaction costs has not
  been checked here.
- **"Plus de 100 catégories" (§1.9)** is a marketing target, not a product
  requirement; ~110 métiers across 15 categories are in place, and the shape
  supports more without touching a screen.
