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
| `GET /health` | Status, transport in use, and whether mail actually sends. |

`key` identifies the sign-up in progress — the phone number — so a resend
replaces the outstanding code rather than adding a second valid one.

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
