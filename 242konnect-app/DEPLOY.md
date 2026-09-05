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
| `_headers`, `_redirects` | the same rules for hosts that read those instead |

All four are **generated**. Do not edit them in place — edit
`tools/build-web.js`, or the next build silently discards your change. That is
not hypothetical: the relative-path rewrite was once done by hand, lost on the
next rebuild, and shipped two blank-page preview links.

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

`242konnect-netlify-package.zip` at the repo root is this same directory,
zipped. Drag it onto <https://app.netlify.com/drop>. Useful for a one-off
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

Then open the deployed URL and sign in with the demo account — **06 000 00 00**
/ `Demo2024` — which needs no e-mail and proves the bundle, fonts and images
all resolved.

Real sign-up additionally needs `{{ .Token }}` in the Supabase **Magic Link**
e-mail template. Without it Supabase mails a link instead of a six-digit code
and verification cannot complete.
