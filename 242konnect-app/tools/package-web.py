#!/usr/bin/env python3
"""Zip the web build into a drop-in Netlify deployment.

The zip is the build directory plus two files that only make sense here:
`_headers` and `_redirects`. Netlify reads those from the *publish directory
root*, and for a drag-and-drop deploy at app.netlify.com/drop the drop root is
this zip's root — so here they are unambiguous.

242Konnect is its own product and its own Netlify site. The Estevao Tati
landing page lives in estevao-tati-site/ with its own package
(scripts/package-estevao-site.py); nothing of it belongs here, and this script
refuses to finish if any of it turns up. For the repo-connected 242Konnect site
`netlify.toml` (written by build-web.js) already carries the same rules.

Usage:  python3 tools/package-web.py [build-dir] [output.zip]
"""

import pathlib
import sys
import zipfile

SUPABASE = "https://abdmdtftnuyjzkdkcwiq.supabase.co"

HEADERS = f"""/_expo/static/*
  Cache-Control: public, max-age=31536000, immutable
/assets/*
  Cache-Control: public, max-age=31536000, immutable
/index.html
  Cache-Control: public, max-age=0, must-revalidate

# Deployed on its own there is no landing page to inherit a policy from, so the
# app states its own. connect-src names the one Supabase project it uses for
# verification codes, profiles and the PIN function; without it sign-up fails
# silently, because the browser blocks the request rather than the server.
/*
  X-Frame-Options: SAMEORIGIN
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=()
  Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
  Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; font-src 'self' data:; img-src 'self' data: blob:; connect-src 'self' {SUPABASE}; frame-ancestors 'self';
"""

# Anything that is not a real file goes to the root — a redirect, not a
# rewrite. A 200 rewrite keeps the requested URL, and the build's references are
# relative so that it works at any depth: at "/a/b" they would resolve under
# "/a/", the browser would receive index.html where it expects JavaScript, and
# the page would be blank with nothing failing to show for it.
REDIRECTS = "/*  /  301\n"

REPO = pathlib.Path(__file__).resolve().parents[2]
build = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else REPO / "242konnect-web")
out = pathlib.Path(sys.argv[2] if len(sys.argv) > 2 else REPO / "242konnect-netlify-package.zip")

if not (build / "index.html").exists():
    raise SystemExit(f"no build at {build} — run npm run build:web first")

# Nothing of the landing page may travel with the app: no page of its own, no
# config, no asset. The bundle is checked too, because a stray import would put
# the landing page's text inside the JavaScript rather than beside it.
FOREIGN = ("estevao", "os.html", "gsap", "cloudfront", "bg-tech", "chakra petch")
files = [p for p in sorted(build.rglob("*")) if p.is_file()]
for p in files:
    rel = str(p.relative_to(build)).lower()
    text = p.read_text(encoding="utf-8", errors="ignore").lower() if p.suffix in (".html", ".js", ".toml", ".json") else ""
    hit = next((f for f in FOREIGN if f in rel or f in text), None)
    if hit:
        raise SystemExit(f"landing-page content ({hit!r}) found in {rel} — the 242Konnect package must stand alone")

with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as z:
    count = 0
    for p in files:
        z.write(p, p.relative_to(build))
        count += 1
    z.writestr("_headers", HEADERS)
    z.writestr("_redirects", REDIRECTS)
    count += 2

print(f"{out.name}: {count} entries, {out.stat().st_size:,} bytes — 242Konnect only")
