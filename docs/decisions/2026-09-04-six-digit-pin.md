# The 6-digit PIN is checked on the server, never on the device

**Date:** 2026-09-04
**Status:** implemented

## The decision

A user-chosen 6-digit PIN becomes the second factor at sign-in, replacing the
mailed code on a device the account has used before. The PIN is hashed and
compared **only** inside the `pin` Supabase Edge Function, running as the
service role. Nothing about it — not the hash, not the salt, not the attempt
count — is reachable from the app.

## Why the server, and not the app

One number decides this: a 6-digit PIN has a keyspace of 10⁶.

Anything that can read `pin_hash` can exhaust that keyspace offline. Measured
on this hardware, PBKDF2-SHA256 at 210,000 iterations costs ~100 ms per guess,
so a stolen hash falls in about 27 CPU-hours — and that is the *expensive*
case. A fast hash (SHA-256, as the app already uses for passwords) would take
under a second. There is no iteration count that makes a client-side PIN check
safe, because the attacker sets the iteration count once they hold the hash.

So the properties are structural rather than chosen:

- `public.user_pin` has RLS enabled and **zero policies**. No anon or
  authenticated client can read or write it at all. This is not a gap to be
  filled with policies later — it is the design, and adding a `SELECT` policy
  would break it.
- The user is taken from the verified JWT, never from the request body.
- Wrong guesses are counted in `app_metadata`, which only the Admin API writes.
  Five failures lock the PIN for fifteen minutes. Without a lockout, 10⁶ online
  guesses is a few patient hours, and the hash cost buys nothing.
- Obvious PINs (`000000`, `123456`, `121212`, `456456`) are refused at the point
  of choice. Five tries is plenty to walk the top five, so the lockout alone
  does not cover them.

## Why a PIN at all, when there is already a mailed code

Because waiting on an e-mail at every sign-in is what makes people turn
two-factor off. The PIN keeps the second factor and removes the wait.

It remains a genuine second factor, not a shortcut past one. Signing in with a
PIN takes three things: the password (known), a refreshable Supabase token this
device earned by completing a full e-mail verification (possession), and the
PIN (known). The token alone signs nobody in — the app's session is a separate
record that sign-out clears — and the PIN alone is refused without it.

## What this cost

**Sign-out no longer clears the Supabase token.** It clears the app session,
which is what signing out means; the token stays as proof that this account has
been verified on this phone. That token is the only way to obtain a bearer
token before any factor is proved, so without it the PIN cannot be checked at
all. Uninstalling or clearing app data drops it, and the next sign-in falls
back to the mailed code.

**No schema change was needed.** `user_pin` as it stands — `user_id`,
`pin_hash`, timestamps, RLS on, no policies — is exactly right. Attempt state
went into `app_metadata` specifically to avoid adding columns.

## What is still open

- The PIN's authenticated round trip (set → verify → wrong → lockout) has not
  been exercised end to end against a real user token. The function's auth gate
  was checked live (no token → 401 `missing_token`, bad token → 401
  `invalid_token`), and the crypto and policy logic pass 12 assertions in
  `pin-logic.test.mjs`, but signing in as a real user needs a code from a real
  inbox. First real sign-up proves it.
- `verify_jwt` is **off** on the function, deliberately. The gateway's check
  accepts the anon key as a valid JWT, so it would not give per-user protection
  anyway; the in-function `admin.auth.getUser(token)` is the real gate, and
  keeping the gateway out of the way lets the function return typed error codes
  the app can translate instead of an opaque 401.
- Reinstall recovery is still unsolved, and unrelated to the PIN: the password
  hash lives on the device, so a fresh phone cannot sign in. Moving the password
  to Supabase Auth's own field is the fix, and is a larger change.
