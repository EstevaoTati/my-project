# 242Konnect — Prestataire account, V1 plan

Source: two specs from the founder (2026-10-20):
"App V1 Parcours Prestataire" (17 pages, 14 mock-ups) and
"Boutons Jobs, Publier et Messages" (13 pages, 6 mock-ups).

## Gap analysis (state on 2026-10-20)

| Spec | Today | Gap |
|---|---|---|
| 01–07 Profile, dossier, contract, verification | Done: sign-up, dossier, contract, review status (`EspacePrestataire`, `DossierPrestataire`) | Document statuses per file; Storage for documents (F-16) |
| 08 Provider dashboard (Home) | Pro Home = the client marketplace under a dark header | **Spec: provider mode must not browse competitors.** Dashboard with real counters, Available toggle |
| 09 + Jobs 1.1–1.4 Requests | Requests are addressed to one prestataire, inside the Profil tab | **Open requests**: visible to every eligible prestataire (trade + city), first to accept wins, atomically. Jobs tab: Available / My jobs / History |
| 10 Execution and proofs | Stages with timestamps (on the way → completed) | Before/after photos, timer → phase 2 (needs Storage) |
| Messages 3.1–3.3 | Messages tab = local demo threads | Real conversations per request, unread counts, job banner, contact masking |
| + Publish (gallery) | FAB opens the Espace Prestataire | Phase 2: Storage, moderation, consent, visibility |
| 11 Availability, long projects | Durations accepted per listing | Available toggle now; calendar and milestones phase 2 |
| 12 Earnings and payouts | Escrow math (`settle`) | Read-only earnings now; payouts need operator disbursement (phase 2) |
| 13 Performance | — | Phase 3: needs reviews and real data |
| 14 Profile and settings, mode switch | Client/Prestataire switch exists | Layout per mock-up |
| Client side: "Publier une demande" (FAB) | **A demo**: says "Votre demande est en ligne", sends nothing | Becomes a real open request, paid then broadcast |

## Decisions

- **Open requests are built now.** The spec makes them the core of Jobs, and
  the client's "Publier une demande" button already promises them. Directed
  requests (to one prestataire) stay.
- **Look: the mock-ups.** Light background, yellow for the active tab and
  key actions, black primary buttons. This replaces the dark "Mode Pro"
  palette of 2026-10-19; what makes the provider account distinct is now its
  content (dashboard, Jobs, no competitor browsing) plus the yellow accents.
- **Labels stay French first, with English.** The mock-ups are in English to
  show the target; the app keeps one language per screen, chosen in settings.
- **No message before assignment on open requests.** Several prestataires
  chatting with one client before anyone accepts would be spam; directed
  requests keep their chat.

## Phase 1 — now

1. Database (`20261021000000_provider_workspace.sql`): `available` on
   listings; open requests (`provider_id` null, `city`); visibility to
   eligible prestataires only; `claim_request()` (atomic, first wins);
   `dismiss_request()` and `request_dismissals` (History, including
   "Already assigned"); `request_reads`, `mark_read()`, `my_conversations()`;
   contact details and links masked in messages, logged.
2. App, provider mode: dashboard (Home), Jobs, Messages, Profile and
   settings; the Available toggle.
3. App, client: "Publier une demande" creates a real open request, paid
   through the `payment` function like any other.
4. Tests: database (replica, then production rolled back), fake Supabase,
   end-to-end journey with two prestataires racing for one request.

## Phase 2

Share your work (+): Storage bucket, up to 10 photos and 1 video, consent,
visibility, moderation, gallery, reports. Mission proofs: before/after
photos, timer. Identity documents to Storage (F-16). Earnings: payouts once
MTN/Airtel disbursement is contracted. Push notifications. Chat attachments,
quotes, time confirmation.

## Phase 3

242K score, performance, training, visibility options, creator programme,
Business account.

## KPIs

Time from payment to acceptance; share of open requests accepted within the
deadline; requests expired unanswered; messages masked per week (abuse
signal); prestataires available per trade and city.
