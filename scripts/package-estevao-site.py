#!/usr/bin/env python3
"""
Builds netlify-package.zip: the Estevao Tati landing page, and nothing else.

The zip holds the contents of estevao-tati-site/ at its root, plus a
netlify.toml derived from the repository's (same proxy, headers and cache
rules) with `publish = "."`, because in a drag-and-drop deploy the drop root
*is* the site.

It refuses to finish if anything belonging to 242Konnect ends up inside: the
two products are deployed separately, and 242Konnect has its own package
(242konnect-netlify-package.zip, built by 242konnect-app/tools/package-web.py).

Usage:  python3 scripts/package-estevao-site.py
"""
import pathlib
import re
import sys
import zipfile

ROOT = pathlib.Path(__file__).resolve().parent.parent
SITE = ROOT / "estevao-tati-site"
OUT = ROOT / "netlify-package.zip"

toml = (ROOT / "netlify.toml").read_text(encoding="utf-8")
# The repository's header explains the split from 242Konnect; the package does
# not need it — it is only this site. Keep everything from [build] on.
toml = (
    "# Estevao Tati — landing page. Drag-and-drop package: the drop root is the site.\n\n"
    + toml[toml.index("[build]"):]
)
toml = re.sub(r'publish\s*=\s*"[^"]*"', 'publish = "."', toml, count=1)

files = sorted(p for p in SITE.rglob("*") if p.is_file() and p.name != ".DS_Store")
names = [str(p.relative_to(SITE)) for p in files]

leaks = [n for n in names if "242konnect" in n.lower()]
if leaks or "242konnect" in toml.lower():
    sys.exit(f"242Konnect content found in the Estevao package: {leaks or 'netlify.toml'}")

with zipfile.ZipFile(OUT, "w", zipfile.ZIP_DEFLATED) as z:
    for path, name in zip(files, names):
        z.write(path, name)
    z.writestr("netlify.toml", toml)

print(f"{OUT.name}: {len(names) + 1} entries, {OUT.stat().st_size:,} bytes — Estevao Tati site only")
