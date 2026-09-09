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
