# 242Konnect — alignment with the three "App V1" specifications

Date: 2026-09-30
Sources: `242Konnect_App_V1_Parcours_Client_Feedback.docx` (14 sections),
`242Konnect_App_V1_Parcours_Prestataire_Feedback.docx` (14),
`242Konnect_App_V1_Commande_Paiement_Service.docx` (11).

## Decisions taken

1. **Pay first, then the request is sent.** The Commande document supersedes the
   older Demande → Acceptation → Paiement order: "242Konnect doit autoriser puis
   conserver les fonds". A booking is now drafted, reviewed (§04), authorised
   with an explicit tick (§06) and only then sent to the prestataire (§07).
   Rationale: a prestataire never accepts unpaid work, and "un seul Prestataire
   peut accepter" is enforceable because acceptance requires a paid request.
2. **Business is shown, not offered.** Client §04 and Prestataire §01 list three
   roles; the founder earlier removed Business as an account type. Both are
   honoured: Business appears as a disabled third card marked "Sur demande ·
   validation 242Konnect requise". The Business journey is the next spec.
3. **Consent is stamped by the database, not the phone.** New table
   `public.consent_records`: append-only (authenticated has SELECT + INSERT
   only), a trigger overwrites `user_id`, `accepted_at`, IP (first hop of
   `x-forwarded-for`) and user agent. That is the "adresse technique" and
   timestamp Prestataire §06 asks for; a client clock cannot forge it. Bumping a
   version constant in `src/consent.ts` forces re-acceptance for every account.
4. **Correction/deletion are requests, not actions** (`public.data_requests`):
   deleting an account with held funds or an open dispute would destroy the
   evidence §10–§11 depend on.
5. **Pricing is a model, never an hourly default** (Prestataire §03): fixed /
   from / hourly / quote + negotiable + accepted durations; currency derived from
   the verified country (FCFA Congo, USD United States). Old hourly-only accounts
   are read as hourly.
6. **The verified name is read-only** (Client §14, Prestataire §02); corrections
   go through Profil › Confidentialité.
7. **Idempotency on payment** (Commande §06): one key per order, sent to the API;
   the API returns the existing collection for a replay and refuses the same key
   for a different amount.
8. **Accessibility fix found on the way:** react-native-web 0.21 ignores
   `accessibilityState`, so no selected/checked/expanded state reached screen
   readers on the web. All 46 uses converted to `aria-*` props.
9. **PIN function left alone.** The live `pin` Edge Function is already v4 with
   `verify_jwt: false` and an OPTIONS handler (redeployed 2026-09-11, not from
   this repo). It was not redeployed. Its lockout is in-memory per isolate — see
   gaps.

## Section-by-section status

Legend: ✅ done in the app · 🟡 partial · 🔴 needs a backend or a provider.

### Parcours Client

| § | Item | Status | Where / what is missing |
|---|---|---|---|
| 01 | Launch screen | ✅ | `SplashScreen` (verify-logo) |
| 02 | Sign-in by phone or e-mail, show/forgot, button enabled only when valid | ✅ | `SignInScreen` |
| 03 | Location & language, permission first | 🟡 | Country/city picker and FR/EN switch exist; no GPS permission flow or suspicious-country detection (needs server-side checks) |
| 04 | Client / Service Provider / Business, role never auto-changed | ✅ | Business shown disabled; dossier activation does not switch the active profile |
| 05 | Identity, country → regions, duplicate detection, SMS preferred | 🟡 | Duplicates refused platform-wide (`profiles` unique). **Codes go by e-mail only — no SMS provider** |
| 06 | Address + landmark, max 3 interests | ✅ | Limit enforced in UI and `startSignUp`; categories still in code, not admin-managed 🟡 |
| 07 | 6-digit code, 10-min expiry, single use, resend | 🟡 | App says 10 min; **set Auth → Email OTP Expiration = 600 in Supabase**. No "modify number" link on the code screen |
| 08 | Password rules, strength, masked | ✅ | `CreatePasswordScreen` |
| 09 | 6-digit PIN, lock after 5 | 🟡 | Works live; lockout is per Edge isolate (in-memory) — should use `user_pin_security` |
| 10 | Consent: CGU, privacy, explanations, separate marketing, recorded version/date | ✅ | Consent step, `consent_records`, `ConsentGateScreen`, Profil › Confidentialité. Data-controller contact: set `EXPO_PUBLIC_PRIVACY_CONTACT` |
| 11 | Home: location, search, categories, notifications | 🟡 | Exists; notifications are local, not pushed |
| 12 | Filters price/rating/distance/availability/verification/type; score explained; badge types | 🟡 | Filters, badges and score explanation done. Registered prestataires now listed from the server ("Prestataires inscrits", filtered by country); the design catalogue is still demo data |
| 13 | Provider profile, no phone/e-mail, contact via request/chat | ✅ | `ListingScreen`; chat per request in `request_messages` (2026-10-01) |
| 14 | My jobs Active/Completed/Cancelled; verified name/phone locked; "Offer your services" separate dossier | ✅ | Filters in Missions; `ProviderDossierScreen` |

### Parcours Prestataire

| § | Item | Status | Where / what is missing |
|---|---|---|---|
| 01 | Role choice, no automatic activation, required pieces shown | ✅ | Sign-up + dossier both list pieces first |
| 02 | Photo, identity, country-driven currency | ✅ | Name locked after creation |
| 03 | Pricing models, negotiable, durations, USD/FCFA, no hourly default | ✅ | `pricing.ts`, `PricingEditor` |
| 04 | Bio, education, experience, ≤5 documents with status | 🟡 | Cap and "Reçu" status done; **documents stay on the device** — no private upload, virus scan or reviewer statuses (needs Storage + back office) |
| 05 | Review before submission, edit without losing data | ✅ | Review block with "Modifier" per section |
| 06 | Contract: read, accept, sign; version/date/IP/proof; re-accept on new version | ✅ | Server-stamped in `consent_records` |
| 07 | Verification tracking, preview, not bookable | ✅ / 🟡 | Server-side status, enforced by the database; approval is manual SQL until a reviewer console exists |
| 08 | Dashboard: requests, missions (accepted/in progress/completed/cancelled), counters from real data | ✅ | Counters from `service_requests` (`ProviderInbox`) |
| 09 | Incoming request with hidden address, expiry, accept/decline/message | ✅ | Address released by RLS only after acceptance; 24 h expiry |
| 10 | Execution proofs (depart, arrival, before/after photos, time) | 🟡 | Stages driven by the prestataire and timestamped by the server; before/after photos not yet |
| 11 | Availability calendar, long projects | 🔴 | Durations only; no calendar |
| 12 | Earnings and payouts | 🟡 | Terms shown; no real balance |
| 13 | Performance, score, programme | 🟡 | Structure only; score needs real data |
| 14 | Settings, client mode on same account, Business on request | ✅ | Profile switch; Business on request |

### Commande, paiement et service

| § | Item | Status | Where / what is missing |
|---|---|---|---|
| 01 | Request: description, saved or other address, private until acceptance | ✅ | Booking sheet; market check is a notice, not geocoding 🟡 |
| 02 | ASAP or slot, duration incl. recurring; >7 days → contract | ✅ | Weeks/months/recurring require the project contract |
| 03 | Contract and milestones | 🟡 | Signed before payment; milestone-by-milestone release not modelled |
| 04 | Order review, total = amount authorised, no late fees | ✅ | Recap with protection fee (0) and total |
| 05 | Methods by country | ✅ | Congo: MTN, Airtel, card, transfer · US: card, bank |
| 06 | Authorisation, policy shown, idempotency | ✅ | Explicit tick; key on device and API |
| 07 | Protected payment, request sent, response delay, refuse/expire → other provider or refund | ✅ | 24 h delay, refusal path |
| 08 | Accepted → On the way → Arrived → In progress → Completed | ✅ | Tracker with times (actor simulated until the prestataire app exists) |
| 09 | Approve & release / report issue, validation delay, reviews after decision | ✅ | 48 h stated; reviews only after validation |
| 10 | Dispute: reason, evidence, redo/partial/full refund, frozen funds | ✅ UI / 🔴 review | Structured form; no 242Konnect review console |
| 11 | Cancellation rules, repeat-abuse scoring | 🟡 | Full refund before acceptance; after acceptance → held pending review. Abuse scoring needs a backend |

## Update 2026-10-01 — shared backend

The marketplace backend is live: see
`2026-10-01-242konnect-marketplace-backend.md`. Requests, the address release,
acceptance, stages, validation, disputes and chat now go through Supabase and
reach the other person. Payment confirmation by the operator is the main item
still simulated.

## What blocks the 🔴 items (as of 2026-09-30)

One thing, mostly: **there is no shared backend for requests, missions,
payments and messages.** Everything transactional still lives on one device,
so a prestataire cannot receive a request a client sends. The next build
should be Supabase tables for `service_requests`, `missions`, `mission_events`,
`messages`, `payments` (with the idempotency key as a unique column), RLS per
party, and a small reviewer console for verification and disputes. Real money
additionally needs MTN MoMo / Airtel merchant accounts and a card processor.

## Founder actions (cannot be done from the code)

- Supabase → Auth → Email OTP Expiration → **600** seconds.
- Fix SMTP credentials (auth log still showed `535` earlier) and keep
  `{{ .Token }}` in the Magic Link template.
- Choose an SMS provider for Congo if SMS-first verification (Client §05/§07)
  is required.
- Publish a data-controller contact and set `EXPO_PUBLIC_PRIVACY_CONTACT`.
- Have the CGU, privacy policy and provider contract texts in `src/consent.ts`
  reviewed by counsel; bump the version constants when they change.
