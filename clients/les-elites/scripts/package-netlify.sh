#!/usr/bin/env bash
# Builds ../les-elites-netlify.zip: the public site only, ready for Netlify
# Drop (drag the zip onto app.netlify.com/drop) or any static host.
# Netlify Drop deploys static files only: the /api/submit function is NOT
# included, so the forms say "not switched on yet" until the site is
# connected to Git with netlify.toml (see README → Deploy).
set -euo pipefail
cd "$(dirname "$0")/.."
node scripts/build-pages.mjs --check
OUT="$(cd .. && pwd)/les-elites-netlify.zip"
TMP="$(mktemp -d)"
cp -r index.html catalogue.html manuscrit.html confidentialite.html livres auteurs assets data \
      styles.css pages.css i18n.js ui.js experience.js forms.js robots.txt sitemap.xml "$TMP/"
[[ -n "$(ls media 2>/dev/null)" ]] && cp -r media "$TMP/"
# Drop honours _redirects/_headers (not netlify.toml): mirror the rules.
cat > "$TMP/_redirects" <<'R'
/catalogue        /catalogue.html        200
/manuscrit        /manuscrit.html        200
/confidentialite  /confidentialite.html  200
R
CSP=$(grep -o 'Content-Security-Policy = "[^"]*"' netlify.toml | sed 's/.*= "//; s/"$//')
cat > "$TMP/_headers" <<H
/*
  Content-Security-Policy: $CSP
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=()
/media/*
  Cache-Control: public, max-age=31536000, immutable
H
rm -f "$OUT"
(cd "$TMP" && zip -qr -9 "$OUT" .)
rm -rf "$TMP"
echo "✓ $OUT ($(du -h "$OUT" | cut -f1), $(unzip -l "$OUT" | tail -1 | awk '{print $2}') files)"
