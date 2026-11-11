# 242Konnect — what the first field test changed (Utah, November 2026)

**Date:** 2026-11-11 · **Asked by:** founder, after a test with a group in the
United States: the Prestataire account works; accounts need approving so they
show in their categories and can be contacted; a client who signed up in the
United States sees the Congo; some buttons stay in French in English.

## Decisions

### 1. A client browses their own country — it is not a setting

The country comes from the account (chosen at sign-up, verified with it). The
home header, the area picker, the categories, the trades list and search all
follow it: a US account sees the United States, its cities and its
prestataires; a Congo account sees the Congo. `src/area.tsx`,
`src/components/online/Directory.tsx`.

- The city only **orders** results (same city first, then the rest of the
  country). Filtering to one city would leave most screens empty while the
  directory is young. "Dans ma ville" is available as a sort.
- A country with no fixed city list (the US, where the town is typed) offers
  the cities where prestataires are listed, plus the account's own.
- FCFA price ranges are shown to Congo accounts only.
- The server enforces the same rule for contact (`contact_provider` refuses
  another country); the app-side filter is presentation, not the control.

### 2. With a server configured, the sample catalogue is gone

The design's sample professionals, notifications and local threads were still
shown in production, in Pointe-Noire, to everyone. When Supabase is configured
(`marketplaceEnabled`) the client screens now show **only real, approved
prestataires**. The samples remain for no-server preview builds, which is what
`tools/verify-app.js` exercises.

### 3. Contact requests: writing to a prestataire costs nothing

Until now the only way to reach a prestataire was a paid booking. With Mobile
Money not live, and no payment method at all in the United States, nobody
could contact anybody; a prestataire priced "sur devis" could not even be
asked for the quote.

A contact request is a `service_requests` row of `kind = 'inquiry'`: no
amount, no payment, sent at once with a first message
(`supabase/migrations/20261111000000_contact_requests.sql`).

- It opens the conversation and nothing else: it can never be accepted as a
  mission (accept needs a verified payment) nor paid.
- Phone numbers, e-mails and links are masked in the message **and** in the
  summary on the prestataire's card (`mask_contact_details()`, one definition
  shared with the message trigger). The English crawl found the card showing
  the number in clear; fixed before anything shipped.
- One open contact per client and prestataire; same country; approved
  prestataire only; never oneself; the request quota applies.
- Booking and paying are unchanged. Only the `payment` function marks a
  request paid.

**Trade-off accepted:** masking is pattern-based, so a determined pair can
still exchange a number ("zero six, un deux…"). It raises the cost of leaving
the platform; it does not make it impossible. Each masking is logged
(`message.contact_masked`).

### 4. Approval stays manual for now

A listing is `pending` until 242Konnect approves it; clients only ever see
approved listings (RLS). The four pending listings were approved on
2026-11-11. Procedure: `docs/242konnect-approbation-prestataires.md`. An
in-app reviewer screen is not built — at this volume a table edit is faster
than building and securing an admin role; revisit past ~20 sign-ups a week.

### 5. Language: tested by reading the screens, not the source

`tools/i18n-check.js` only sees strings written as `t('…')`. What stayed
French was everything else: errors thrown outside components, placeholders,
accessibility labels, the trade picker, dates. Changes:

- `tr()` and `locale()` in `src/i18n.tsx` for code outside components;
- `tools/verify-english.js` drives the app in English, sign-up to chat, as a
  US client and a US prestataire, and fails on any French text, label or
  placeholder, and on any key asked for in English with no translation;
- CI now runs the dictionary check in `--strict` mode.

**Known gap:** the crawl covers the screens it visits. The local booking flow
of the no-server preview (`MissionsScreen` simulated steps, `store.tsx`
notices) still has French-only labels; it is not reachable in production.

## Verification

Database replica 106/106 (`supabase/tests/run-local.sh`), `verify-english`
19/19, `verify-marketplace-journey` 27/27, `verify-app` 136/136, the other
journey suites green. Production: migration applied only on the founder's
approval.
