# 242Konnect — mobile client security

**Principle:** the app is an untrusted client. Every rule that matters is
enforced by the server: RLS, triggers, the `pin` function and the API. The
measures below raise the cost of attacking one device. They do not replace
server checks, and none of them is treated as proof of trust.

## In place

- **No secret in the bundle.** Only the Supabase publishable key, which is
  public by design. gitleaks runs on every push.
- **PIN checked on the server**, with a persistent lockout. The device never
  holds a PIN or its hash.
- **Session revoked at sign-out** (F-11).
- **Web build** (Netlify):
  - strict CSP: `script-src 'self'`, `connect-src` limited to the Supabase
    project;
  - `X-Frame-Options`, HSTS preload, `nosniff`.
- **No user-supplied HTML is rendered.** Avatars are constrained to image data
  or https by a database CHECK.

## To do when native builds ship (MASVS-STORAGE, MASVS-RESILIENCE)

| Control | How | Priority |
|---|---|---|
| Session tokens in the OS keystore | `expo-secure-store` (iOS Keychain, Android Keystore) for `SUPABASE_SESSION_KEY`, instead of AsyncStorage. Keep AsyncStorage on the web. | High |
| Remove legacy local password hashes | Delete `ACCOUNTS_KEY` password fields once accounts have migrated (F-12) | Medium |
| Device attestation as a risk signal | iOS **App Attest**, Android **Play Integrity**, verified server-side (Edge Function). Used to **raise friction** (CAPTCHA, step-up) on payments, **never to lock out** a device that cannot attest. | Medium |
| Certificate pinning | Not recommended for now. Supabase certificates rotate; pinning causes outages unless managed carefully. TLS plus HSTS is enough at this stage. | Low |
| Screenshot/backup exclusion on PIN and payment screens | `FLAG_SECURE` on Android; exclude from iCloud backup | Low |
| Release hardening | Hermes bytecode, no `console.log` of personal data, `debuggable=false` | Low |
