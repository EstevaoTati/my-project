# Security posture for the church site: headers, not a server

**Date:** 2026-09-05 · **Status:** accepted

## Context

The founder asked to "strengthen the backend and front end and put anti-hacking
tools for security" on the Holy Mountain Washington Church site.

There is no backend. The site is static HTML, CSS and images on a CDN. The only
server-side component is Netlify Forms, which receives the contact form. There
are no accounts, no session, no database, no secrets in the repository.

## Decision

Do not build a server in order to have something to secure. Harden the two
things that actually exist: what the browser is allowed to do with the page,
and what the form accepts.

**Headers**, scoped to `/holy-mountain/*` in `netlify.toml`: a
Content-Security-Policy with no `unsafe-inline` for either script or style,
`frame-ancestors 'none'`, `form-action 'self'`, `base-uri 'none'`,
`object-src 'none'`, nosniff, a deny-all Permissions-Policy, COOP, CORP and
HSTS.

**The page** was changed to fit that policy rather than the policy loosened to
fit the page. Every `style="..."` attribute was moved into the stylesheet, and
the one inline script left, the JSON-LD block, is allowed by SHA-256 hash.
`tools/csp-hash.sh` recomputes it.

**The form** keeps the honeypot and Netlify's spam filtering, and adds
`maxlength` caps, layered validation and a submit lock.

## Why not more

- **A serverless function in front of the form** would add a component to
  patch, a place for secrets to leak and a new failure mode, to duplicate
  validation Netlify already performs. Rejected.
- **A CAPTCHA** would load Google code into a page whose entire policy exists
  to forbid third-party script. If spam becomes real, raise Netlify's own
  filtering first.
- **A Web Application Firewall** protects an origin server. There isn't one.

## Consequences

- Two maintenance rules now bind, both documented in the site's README: no
  inline styles, and re-run the hash script after editing the JSON-LD.
- The policy will block any third-party embed (a YouTube player, a Google map,
  an analytics tag) until it is explicitly allowed. That is the intended
  trade-off; the sermons section links out rather than embedding.
- Headers cannot protect the accounts that can change the site. The residual
  risk is credential theft on Netlify, GitHub and the notification inbox, so
  the README asks for two-factor authentication on all three.
