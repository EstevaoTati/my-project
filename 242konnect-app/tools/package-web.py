#!/usr/bin/env python3
"""Zip the web build into a drop-in Netlify deployment.

The zip is the build directory plus two files that only make sense here:
`_headers` and `_redirects`. Netlify reads those from the *publish directory
root*, and for a drag-and-drop deploy at app.netlify.com/drop the drop root is
this zip's root — so here they are unambiguous.

They are deliberately absent from the committed build directory. While
242Konnect is still served as a sub-path of the landing page, that directory
sits inside somebody else's published tree, where a `/*  /index.html  200` rule
would be at best inert and at worst would replace the landing page with the
app. `netlify.toml` (written by build-web.js) already covers the repo-connected
deployment, so nothing is lost by keeping the pair out of the tree.

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
  Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; font-src 'self' data:; img-src 'self' data: blob:; connect-src 'self' {SUPABASE}; frame-ancestors 'self';
"""

# Single-page app: a deep link must open the app, not a 404.
REDIRECTS = "/*  /index.html  200\n"

REPO = pathlib.Path(__file__).resolve().parents[2]
build = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else REPO / "242konnect-web")
out = pathlib.Path(sys.argv[2] if len(sys.argv) > 2 else REPO / "242konnect-netlify-package.zip")

if not (build / "index.html").exists():
    raise SystemExit(f"no build at {build} — run npm run build:web first")

with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as z:
    count = 0
    for p in sorted(build.rglob("*")):
        if p.is_file():
            z.write(p, p.relative_to(build))
            count += 1
    z.writestr("_headers", HEADERS)
    z.writestr("_redirects", REDIRECTS)
    count += 2

print(f"{out.name}: {count} entries, {out.stat().st_size:,} bytes")
