# 242Konnect API

Verification codes, sent by e-mail. The first slice of the API the cahier des
charges describes (§10.5), on the stack it fixes (§11.2: Python / FastAPI).

## Why this exists

The app cannot send e-mail safely on its own.

Sending needs a provider API key, and a React Native bundle is **extractable** —
anyone with the APK can pull a key out of it and send mail as 242Konnect.
That is a phishing vector under the brand, and the bill arrives here. So the key
lives on this server and the app only ever asks it to send.

## Running it

```sh
cd 242konnect-api
python3 -m venv .venv && ./.venv/bin/pip install -r requirements.txt
cp .env.example .env          # then fill it in
./.venv/bin/uvicorn app.main:app --reload
```

Without `RESEND_API_KEY` the service still starts and **prints** the message
instead of sending it — that is the development transport, and it says so
loudly in the console and in `GET /health` (`"sends_email": false`).

### Configuration

| Variable | Effect |
|---|---|
| `RESEND_API_KEY` | Enables real sending. Absent → console transport. |
| `OTP_MAIL_FROM` | Sender. **Must be a domain verified in Resend**, or delivery is refused. |
| `OTP_PEPPER` | Salts the stored code hashes. Any long random string. Absent → a per-process random value, so codes stop working across a restart. |
| `CORS_ORIGINS` | Comma-separated. `*` in development; narrow it in production. |

Swapping Resend for SendGrid, Mailgun or SES means writing one more `Transport`
in `app/mailer.py`. Nothing else in the codebase names a provider.

## Endpoints

| | |
|---|---|
| `POST /auth/otp/start` | `{key, email}` → mails a code. **Never returns the code.** |
| `POST /auth/otp/verify` | `{key, code}` → `{verified: true}` or a 4xx. |
| `POST /payments/momo/request-to-pay` | `{operator, phone, amount}` → starts a Mobile Money collection. |
| `GET /payments/momo/{id}` | Where that collection has got to. |
| `GET /health` | Status, transport in use, whether mail sends, which operators are live. |

`key` identifies the sign-up in progress — the phone number — so a resend
replaces the outstanding code rather than adding a second valid one.

## Mobile Money

MTN MoMo and Airtel Money collections, in `app/momo.py`.

A mobile money debit is **asynchronous**, and the API's shape follows from that:

```
request-to-pay  →  operator prompts the handset for a PIN  →  poll GET /{id}
```

`request-to-pay` returns as soon as the prompt is *sent*, with `status:
"pending"`. Nothing has been debited at that point — the customer has up to a
minute or so to enter their PIN on their own phone, which is far longer than an
HTTP request should be held open. The app polls until the status leaves
`pending` for `successful`, `failed` or `expired`.

Two rules the tests pin down, because getting either wrong loses money:

- **A failed status *read* is not a failed *payment*.** If the operator is
  unreachable mid-poll, the collection stays `pending`. Reporting it failed
  would tell the customer nothing was taken while the operator disagrees.
- **A rejected request records nothing.** If the prompt never reached the payer,
  there is no transaction to poll.

MTN's `X-Reference-Id` is our own id, which is what makes a retry idempotent
rather than a double debit.

### Configuration

Absent credentials mean that operator is refused with a clear message, never
faked. `GET /health` reports which are live.

| Variable | Effect |
|---|---|
| `MTN_MOMO_SUBSCRIPTION_KEY` | Collections product subscription key. |
| `MTN_MOMO_API_USER` / `MTN_MOMO_API_KEY` | API user UUID and its generated key. |
| `MTN_MOMO_ENVIRONMENT` | `sandbox`, or the production target id. |
| `MTN_MOMO_BASE_URL` | Defaults to the sandbox host. |
| `AIRTEL_CLIENT_ID` / `AIRTEL_CLIENT_SECRET` | OAuth2 client credentials. |
| `AIRTEL_ENVIRONMENT` | `sandbox` or `production`; picks the default host. |
| `AIRTEL_COUNTRY` / `AIRTEL_CURRENCY` | `CG` / `XAF` for the Republic of the Congo. |

Both operators require a **merchant account and KYC** before production
credentials are issued; sandbox credentials are self-service and enough to
exercise the whole path.

### Before production

`_STORE` in `app/momo.py` is an in-process dict, exactly like the OTP store. A
second worker will not see a collection the first one started, so the status
poll would 404. Move both to Redis or Postgres before running more than one
process — this is the one thing that will break under a real deployment.

## What it protects against

- **Codes are stored hashed** (HMAC-SHA256 + pepper). A process dump or a stray
  log line should not hand over live codes.
- **Constant-time comparison.** A plain `==` leaks how much of the code was
  right through timing, which matters for a six-digit secret.
- **Attempts are capped** at 5, then the challenge is destroyed — a six-digit
  space is walkable otherwise.
- **Codes expire** after 10 minutes and are **single-use**.
- **Resends are rate-limited** to one per 30 s per key.
- **Provider errors are logged, not returned.** Resend's message can name the
  key or the domain; the client gets a generic French sentence.

## Connecting the app

Set `EXPO_PUBLIC_API_URL` when building:

```sh
EXPO_PUBLIC_API_URL=https://api.242konnect.net npx expo export --platform web
```

Unset, the app falls back to generating a code on the device and showing it
behind a "démonstration" notice — no e-mail is claimed to have been sent.

> Metro caches `EXPO_PUBLIC_*` values. After changing one, build with `--clear`
> or the old URL stays baked into the bundle. This cost an hour once.

## Tests

```sh
./.venv/bin/python -m pytest tests/ -q
```

14 tests, weighted towards the security properties rather than the happy path:
the code never appears in a response, wrong codes are refused, attempts are
capped, codes expire and cannot be replayed, and a provider failure does not
leak the key.

## Not built yet

Accounts, missions, payments, messaging — everything else in §10.5. This service
exists because e-mail delivery was the blocking dependency; the rest of the API
is a separate build. Storage is in-process, so codes do not survive a restart;
moving to PostgreSQL means replacing one dict in `app/otp.py`.
