# The church site's CSP carries no `upgrade-insecure-requests`

**Date:** 2026-09-18
**Status:** Adopted
**Scope:** `holy-mountain/` — the site-wide Mwinda policy is unchanged.

## What happened

`holymountainch.com` was deployed from `holy-mountain-netlify.zip` and rendered
as unstyled HTML: Times New Roman, blue underlined links, no images, and both
the desktop navigation and the mobile drawer visible at once. The HTML was
intact; nothing else loaded. Safari showed the "Not secure" warning in the
address bar.

## Cause

The shipped Content-Security-Policy ended in `upgrade-insecure-requests`. That
directive rewrites every subresource request to `https://`. The domain was
still being served over plain HTTP — Netlify had not yet issued the
certificate for the newly attached domain — so each rewritten URL failed, and
the browser was left with the document and nothing else.

It was reproduced rather than assumed. A first attempt on `127.0.0.1` showed no
difference and proved nothing: localhost is a *potentially trustworthy* origin
and is exempt from the upgrade. Re-run against a real origin
(`--host-resolver-rules=MAP church.test 127.0.0.1`, a local server sending the
shipped policy), the two cases separate cleanly:

|                        | with the directive | without it |
| ---------------------- | ------------------ | ---------- |
| `h1` font / size       | Times New Roman 32 | Anton 38   |
| mobile drawer visible  | yes                | no         |
| stylesheet rules       | 0                  | 241        |
| emblem loaded          | no                 | yes        |
| failed subresources    | 10                 | 0          |

## Decision

Remove the directive from the church policy — in `package.sh`, `netlify.toml`
and `_headers` — and do not reintroduce it.

The trade is one-sided. Every asset URL in the page is relative, so it already
follows the document's scheme and there is never a mixed-content request for
the directive to upgrade; it can only ever fire during the plain-HTTP window,
where it takes the site down. Transport security belongs to the certificate and
**Force HTTPS**, with `Strict-Transport-Security` locking it in afterwards.

`Strict-Transport-Security` was also softened from
`max-age=63072000; includeSubDomains; preload` to `max-age=31536000`.
`preload` is close to irreversible once the domain is on the browsers' list,
and `includeSubDomains` commits every future subdomain of a domain the church
has only just registered. A year of HTTPS-only on the apex is the right posture
for a site this age; either flag can be added later, neither can be easily
taken back.

## Consequence for the Mwinda site

None. `mwindadigital.com` has served HTTPS since launch, and its generated
policy keeps its own `upgrade-insecure-requests`. The two policies are separate
lines and `scripts/update-csp.mjs` does not manage the church block.
