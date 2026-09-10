# Deploying 242Konnect as its own site

242Konnect is a product, not a page on the Mwinda Digital consulting site. It
gets its own Netlify site, its own domain, and its own security policy.

Today both are served by one Netlify project (`poetic-ganache-d4113e`), with
the landing page at `/` and the app at `/242konnect-web`. That is why the
share links carry someone's name and a borrowed path. This document is how to
end that.

## What the build produces

`npm run build:web -- --output-dir ../242konnect-web` writes a **complete,
self-contained site** into `242konnect-web/`:

| | |
|---|---|
| `index.html`, `_expo/`, `assets/` | the app, with every reference relative so it works at any depth |
| `netlify.toml` | publish, SPA redirect, security headers, caching |

Both are **generated**. Do not edit them in place — edit `tools/build-web.js`,
or the next build silently discards your change. That is not hypothetical: the
relative-path rewrite was once done by hand, lost on the next rebuild, and
shipped two blank-page preview links.

`_headers` and `_redirects` are deliberately *not* in this folder. Netlify reads
them from the publish directory root, which — while the app is still served as a
sub-path of the landing page — is the repo root. Whether a copy sitting in a
subfolder is ignored is a claim about Netlify's resolution that cannot be tested
from the build environment, and if it were wrong a `/*  /index.html  200` rule
would replace the landing page with the app. `netlify.toml` already covers the
repo-connected deployment, so the pair lives only in the zip, where the drop root
*is* this directory and there is no ambiguity. `python3 tools/package-web.py`
builds it.

## Giving it its own site (one step, needs your Netlify account)

1. Netlify → **Add new project** → **Import an existing project** → this repo.
2. Set **Base directory** to `242konnect-web`. Leave build command empty and
   publish directory `.` — the generated `netlify.toml` supplies both.
3. Set the site name to `242konnect`.

### The exact fields, for a site that is already connected

Only the first is yours to set; the rest are supplied by `242konnect-web/netlify.toml`,
which **overrides whatever the UI shows**.

| Field | Value | Who sets it |
|---|---|---|
| Branch to deploy | `claude/sleek-skill-project-1knsscftutfd-0h5mcr` | you |
| **Base directory** | `242konnect-web` | **you — this is the one that matters** |
| Build command | *empty* | `netlify.toml` |
| Publish directory | `242konnect-web` (shown as linked to the base) | `netlify.toml` |
| Functions directory | *leave empty* | `netlify.toml` now forces it |

**Why the functions directory is called out.** Once a base directory is set, the
UI offers the same folder as the functions directory, and it was reported showing
`242konnect-web/`. That folder is the *published* app: it contains a 1.3 MB
`_expo/static/js/web/index-*.js`. Netlify would try to bundle that React bundle
as a serverless function, and the deploy fails before publishing anything — with
the three post-deploy checks ("Pages changed", "Header rules", "Redirect rules")
all reporting "Deploy failed", which is the exact signature seen on every commit
of PR #18.

`netlify.toml` now names a functions directory that does not exist, so that
cannot happen again whatever the UI says. 242Konnect ships no Netlify functions
at all; its only server-side code is the Supabase Edge Function, which Supabase
deploys.

**Base directory is the one setting a file cannot fix.** Netlify reads
`netlify.toml` *from* the base directory, so if the base is wrong it never sees
this file — it reads the repo root's instead and publishes the landing page. If
the site is connected and still failing or still serving the wrong site, that is
the field to check first.

That gives you:

```
https://242konnect.netlify.app          ← the app, at the root
```

No `/242konnect-web` suffix, no landing page underneath it, no personal name
anywhere in the URL.

### Or without connecting the repo

`242konnect-netlify-package.zip` at the repo root is this directory plus
`_headers` and `_redirects`; rebuild it with `python3 tools/package-web.py`. Drag it onto <https://app.netlify.com/drop>. Useful for a one-off
share; the repo-connected site is better, because it redeploys on every push.

## Your own domain

`.netlify.app` is fine for testers, wrong for customers in Pointe-Noire. In the
new site: **Domain management → Add a domain** → `242konnect.cg` (or
`app.242konnect.cg`), then point the DNS records Netlify shows you.

Nothing in this repo needs changing — the build is path-independent, so it
works at a root, at a sub-path, and behind a custom domain alike.

## Finishing the separation

Until the new site exists, the root `netlify.toml` still routes
`/242konnect-web` and `/242konnect` so the current preview links keep working.
Once `https://242konnect.netlify.app` is live and you have checked it, delete
those blocks — they are marked in that file — and the landing page stops
carrying the app's configuration entirely.

The static prototype at `/242konnect` (the original three HTML screens in
`242konnect/`) is superseded by the real app and should go at the same time,
unless you still want it as a lightweight no-install demo.

## Checking a deployment

```bash
npm run verify:paths     # the app paints at a root, a sub-path and deeper, no failed request
```

Then open the deployed URL. The welcome screen painting proves the bundle,
fonts and images all resolved.

**Getting past that screen needs a real verification code.** There is no demo
account any more — it put a working password into the shipped JavaScript, which
a production build must not carry — so the only way in is to sign up, and
sign-up mails a six-digit code.

## The e-mail must actually send — two separate settings

Both of these are in the Supabase dashboard. Neither can be fixed from the app,
and either one alone being wrong stops every sign-up.

### 1. SMTP credentials — the cause of "Error sending magic link email"

If sign-up fails the moment you press **Créer mon compte**, this is why. The
project's auth log shows the real reason, which never reaches the browser:

```
POST /otp → 500   error: 535 "Authentication credentials invalid"
```

`535` is the SMTP server rejecting Supabase's login. A custom SMTP server is
configured under **Project Settings → Authentication → SMTP Settings** with a
username or password the provider does not accept, so GoTrue cannot send
anything and answers `unexpected_failure` for every request.

Two ways out:

- **Fix the credentials.** Re-enter the SMTP host, port, username and password.
  For most providers the password is an API key or an app password, *not* the
  account password — that mismatch is the usual cause of a 535.
- **Or turn custom SMTP off**, which falls back to Supabase's built-in sender.
  Good enough to test with, not to launch on: it only delivers to addresses on
  the project's team, and it is rate-limited to a couple of messages an hour.

To confirm it is fixed, watch the log rather than the screen — a send that works
leaves a `POST /otp` with status `200`.

### 2. `{{ .Token }}` in the Magic Link template

**Authentication → Emails → Magic Link.** Without it Supabase mails a *link*
instead of the code, the Vérification screen has nothing to accept, and nobody
can create an account. The body needs the token itself, for example:

```
Votre code de vérification 242Konnect : {{ .Token }}
```

Note that the code is never readable from the database: Supabase stores only a
SHA-224 hash of it in `auth.one_time_tokens`. The inbox is the only place it
exists, which is the point — but it does mean a broken mailer cannot be worked
around by reading the code out of the project.

## Where the accounts are

An account is not real until it exists in `public.profiles`. Two things had to
be true for that, and neither was.

### The table grant (fixed — migration in the repo)

`public.profiles` had correct row-level security policies for `authenticated`
(`auth.uid() = id`, for select/insert/update) and **no table privileges for that
role at all**. Postgres checks privileges *before* RLS, so every write from a
signed-in user was rejected with

```
42501: permission denied for table profiles
```

and the policies never ran. This is the trap that makes a permissions bug look
like a policy bug — the policies were right the whole time.

Fixed by `supabase/migrations/20260910012311_grant_authenticated_access_to_profiles.sql`,
already applied to the live project. `anon` is still granted nothing, `DELETE`
is still granted to nobody, and RLS still restricts every operation to the
caller's own row. Re-check any time with:

```
242konnect-app/tools/verify-profiles-rls.sql
```

It runs in a transaction and rolls back, so it is safe against production.

### The app now writes the row rather than hoping

The row used to be written only at the end of sign-up. Everything after that
just *read* it, and shrugged when it was missing, on the theory that the next
profile edit would push it up. For anyone who never edited their profile, the
next edit never came.

`reconcileProfile` now runs on launch and on both sign-in paths: it reads the
row and creates it when it is absent. An account that could not be saved the
first time gets another chance every time the app opens, and the Profil screen
says plainly when the account exists only on the device.

### Why the table was empty

Five confirmed users in `auth.users`, zero rows in `public.profiles`. Both walls
were up at once: the mailer never issued a session (SMTP `535`), and even a
valid session would have been refused by the missing grant. The grant is fixed;
the SMTP credentials are still yours to correct, above.

Those five are abandoned sign-ups — they verified an address but never finished,
so they have no password and no account. Nothing is lost by leaving them: when
those people sign up again, GoTrue reuses the same user id and the sign-up
completes normally.

## Opening the app over plain http

Chrome only exposes `crypto.subtle` in a **secure context** — https, or
localhost. On a LAN address or an http preview host it refuses:

```
Access to the WebCrypto API is restricted to secure origins (localhost/https)
```

Passwords are hashed before sign-up or sign-in can do anything, so that used to
take out authentication entirely. `src/sha256.ts` now falls back to the same
SHA-256 in plain JavaScript, producing byte-identical hashes, so an account
created over http still signs in over https.

```bash
npm run test:sha256    # the fallback matches Node's SHA-256, including non-ASCII
```

`tools/verify-insecure-origin.js` drives the real build on a non-localhost http
origin and asserts WebCrypto is genuinely unavailable before proving sign-up and
sign-in still work.
