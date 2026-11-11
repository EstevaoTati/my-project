# 242Konnect — the personal PIN is the log-in; accounts live in Supabase

Date: 2026-10-02 · Requested by the founder: "Make sure at setting the
personal PIN, it works. And after that it goes straight to the App. Make sure
that Supabase stores all the personal information… Every user should use
their personal PIN to log in directly."

## What was wrong (from the live project)

- The `pin` function logged three `POST 400` on 2 October from a user whose
  PIN has existed since 11 September. The app decided "define" vs "change"
  from a flag kept on the device; on a fresh browser that flag is gone, so it
  offered *Définir*, sent no current PIN, and the server rightly refused
  (`current_pin_incorrect`). The person was stuck.
- The password was hashed and kept **only on the phone**. Profiles were in
  Supabase, but a new device, reinstall or cleared browser could not sign in
  at all.
- Sign-in offered the PIN only if this device remembered it; otherwise it
  mailed a code every time.

## Decision

| Moment | Now |
|---|---|
| Sign-up | code → password **stored by Supabase Auth** → profile + consents in Supabase → PIN → straight into the app |
| Opening the app | **PIN only** ("Bonjour, {prénom}") — the PIN is the log-in |
| Sign-in (after sign-out, or a new device) | e-mail + password checked by Supabase → PIN → app; profile and consents restored from Supabase |
| PIN forgotten | e-mail code, from the PIN screen |
| Password forgotten | e-mail code → new password stored by Supabase |
| Changing the PIN | the server decides define vs change; a 400 for an existing PIN switches the screen to "change" instead of failing |

Accounts created before this change have no password in Supabase. They are
migrated on their next sign-in: on a device that still has their local
password, the e-mail code proves the address and the password is handed to
Supabase; elsewhere, "Mot de passe oublié" does the same.

## Proof

`242konnect-app/tools/verify-pin-login.js` — 18 checks, two browsers, against
the Supabase stand-in: PIN set → app; password, PIN, profile and consents
stored server-side; reopen → PIN only; wrong PIN refused; sign-out → password
+ PIN; new device restores everything; change-not-define; legacy migration.
All other suites unchanged and green.

## Limits

- A forgotten PIN cannot be *replaced* without the current one (the deployed
  `pin` function requires it). The e-mail code still signs the person in.
  Allowing a reset after a fresh e-mail code means updating that function.
- A phone number signs in only on a device that has seen the account; on a new
  device the app asks for the e-mail address (the auth identity).
