# Mobile Money collections, and the OTP code leaving the screen

**Date:** 2026-08-19
**Status:** implemented; blocked on credentials for production

Two changes that share one rule: **the app must not pretend a thing happened
when it did not.**

## 1. The verification code no longer appears on screen

### What changed

`OtpDelivery` used to be a union with a `demo` arm carrying the code, which the
OTP screen rendered behind a "Démonstration" panel whenever no verification
service was configured. That arm is gone. The type is now:

```ts
type OtpDelivery = { provider: 'supabase' | 'api'; expiresIn: number }
```

No code field. `requestCode` never returns one, nothing in the app generates
one, and verification is always a round trip to the service that issued it.

This is deliberately a **type-level** guarantee rather than a UI fix. A screen
that chooses not to render the code can regress in one edit; a screen with no
code to render cannot.

### Why not keep the demo panel

Showing the code defeated the control it was implementing. Anyone with the link
could create an account on any e-mail address they did not own — which is the
exact thing OTP exists to prevent. That is different in kind from a simulated
payment (see below), where nothing is being protected and no money moves either
way.

### Providers

Picked at build time by whichever variables are set:

| Provider | Variables | Notes |
|---|---|---|
| Supabase | `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Preferred. GoTrue generates, mails, stores in `auth.users`, verifies. |
| 242Konnect API | `EXPO_PUBLIC_API_URL` | The FastAPI service, when the code should come from our own backend. |
| neither | — | Sign-up **fails** with a plain message. Nothing is faked. |

Supabase is preferred for one specific reason: its publishable key is *designed*
to ship inside a client, so a shared preview build can send real e-mail with no
server of ours to deploy. That is the opposite of the Resend key, which must
never be bundled — anyone can unzip an APK and send mail as 242Konnect with it.
The two credentials are not comparable, and the architecture differs because of
it.

### Still needed

The Supabase **project URL**. The publishable key the founder supplied
(`sb_publishable_…`) does not encode the project ref, unlike the older JWT anon
keys, so it cannot be derived. One value, pasted into the build config.

Also, in the Supabase dashboard: the Magic Link e-mail template must contain
`{{ .Token }}`. With the default template GoTrue sends a *link*, not a six-digit
code, and the OTP screen would have nothing to accept.

## 2. Mobile Money that actually collects

### What was there

One tap on "Payer à 242Konnect" wrote a receipt. MTN and Airtel were labels in
a picker with nothing behind them.

### What a mobile money debit actually is

Both operators work the same way, and it is not a form submission:

```
request to pay  →  operator prompts the handset for a PIN  →  poll status
```

Nothing is debited when the request is sent. The customer types their PIN on
their own phone, and the transaction sits PENDING until they do — or until the
prompt expires. **This is why the old one-tap button could never have been
real**: the payment is asynchronous by construction, and the UI has to hold a
pending state for up to a minute or so.

### Built

- `242konnect-api/app/momo.py` — MTN MoMo Collections and Airtel Money
  Collections, credentials server-side. Token fetch, request-to-pay, status
  poll, operator error codes translated to French.
- `POST /payments/momo/request-to-pay` and `GET /payments/momo/{id}`.
- `242konnect-app/src/momo.ts` — the client, plus the polling loop and the
  operator-prefix table.
- The payment sheet now has the real states: sending → awaiting PIN (with a
  countdown and a cancel) → success or a specific failure.
- Escrow is recorded **after** the operator reports success, not on tap.

### Two rules the tests pin down

Both lose money if they go the other way:

- **A failed status *read* is not a failed *payment*.** If the operator is
  unreachable mid-poll the collection stays pending. Reporting failure would
  tell the customer nothing was taken while the operator disagrees.
- **A rejected request records nothing.** If the prompt never reached the payer
  there is no transaction to poll.

MTN's `X-Reference-Id` is our own id, which is what makes a retry idempotent
rather than a double debit.

### Operator prefixes

`OPERATOR_PREFIXES` maps MTN to `06` and Airtel to `04`/`05`. It **warns** on a
mismatch and never blocks: number portability and prefix reallocation both mean
the customer knows their own line better than our table does. Selecting the
wrong operator is the single most common mobile money failure and the operator's
own error for it is opaque, so the warning is worth having — as a warning.

### Why a simulation is still acceptable here

With no gateway configured the sheet walks the same state machine — prompt,
wait, result — and labels the result a simulation. That is honest in a way the
printed OTP was not: no money moves in either case, and a tester sees the real
sequence rather than a button that instantly claims success. Numbers ending in
`0` fail, so the failure path is demonstrable too.

### Still needed

Merchant accounts and KYC with both operators before production credentials are
issued. Sandbox credentials are self-service and exercise the entire path.

`_STORE` in `momo.py` is an in-process dict, like the OTP store. A second worker
will not see a collection the first started. Move both to Redis or Postgres
before running more than one process — this is the one thing that breaks under a
real deployment.

## Consequence for the test suite

`verify-app.js` used to scrape the demo code off the page. It now reads the code
from the service's outbox, the way a user reads their inbox, and separately
asserts that no six-digit run appears anywhere in the page. Running the suite
therefore requires the API running and `EXPO_PUBLIC_API_URL` baked into the
build — which is closer to how the app actually runs.
