#!/usr/bin/env python3
"""Build a lighter Netlify package: same app, smaller fonts and photos.

Nearly half the regular package is not the app at all. It is six font files
carrying every alphabet Inter supports (Cyrillic, Greek, Vietnamese…) and five
photos stored at 1024–1264 px for screens that show them far smaller. This
script copies the web build, trims those two things *in place* — same file
names, same paths — and hands the copy to package-web.py, so the headers,
redirects and the 242Konnect-only check are exactly the regular package's.

Nothing in the JavaScript changes, which is why keeping the names matters: the
bundle refers to every asset by its hashed file name, and expo-font declares
`src:url(...)` with no format hint, so a subset TTF under the same name loads
like the original. Image layout comes from the width/height recorded in the
bundle, not from the file, so a smaller photo fills the same box.

Fonts keep Latin-1, Latin Extended-A, combining accents and the punctuation and
symbols the interface uses (’ “ ” – — … › • − € ★). French and English need
nothing else; anything outside the subset falls back to the system font rather
than disappearing.

Requires: pip install fonttools pillow
Usage:    python3 tools/package-web-lite.py [build-dir] [output.zip]
"""

import pathlib
import shutil
import subprocess
import sys
import tempfile

from fontTools import subset
from PIL import Image

REPO = pathlib.Path(__file__).resolve().parents[2]
build = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else REPO / "242konnect-web")
out = pathlib.Path(sys.argv[2] if len(sys.argv) > 2 else REPO / "242konnect-netlify-package-lite.zip")

UNICODES = (
    "U+0000-017F,U+0192,U+0218-021B,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0300-036F,"
    "U+2000-206F,U+2074,U+20AC,U+2122,U+2190-2199,U+2212,U+2215,U+2605,U+FEFF,U+FFFD"
)
# Photos are shown at most ~390 CSS px wide; 800 px covers a 2x screen.
MAX_SIDE = 800
JPEG_QUALITY = 78

if not (build / "index.html").exists():
    raise SystemExit(f"no build at {build} — run npm run build:web first")


def trim_font(path: pathlib.Path) -> None:
    options = subset.Options()
    # fontTools' default set (kerning, ligatures, contextual alternates, mark
    # positioning) plus tabular figures for prices and codes.
    options.layout_features += ["tnum", "case"]
    options.name_IDs = ["*"]
    options.notdef_outline = True
    options.glyph_names = False
    options.hinting = False  # browsers render Inter unhinted on every platform
    font = subset.load_font(str(path), options)
    subsetter = subset.Subsetter(options)
    subsetter.populate(unicodes=subset.parse_unicodes(UNICODES))
    subsetter.subset(font)
    subset.save_font(font, str(path), options)


def trim_photo(path: pathlib.Path) -> None:
    with Image.open(path) as im:
        im = im.convert("RGB")
        im.thumbnail((MAX_SIDE, MAX_SIDE), Image.LANCZOS)
        im.save(path, "JPEG", quality=JPEG_QUALITY, optimize=True, progressive=True)


with tempfile.TemporaryDirectory() as tmp:
    lite = pathlib.Path(tmp) / "build"
    shutil.copytree(build, lite)

    before = sum(p.stat().st_size for p in lite.rglob("*") if p.is_file())
    for p in sorted(lite.rglob("*.ttf")):
        trim_font(p)
    for p in sorted(lite.rglob("*")):
        if p.suffix.lower() in (".jpg", ".jpeg"):
            trim_photo(p)
    after = sum(p.stat().st_size for p in lite.rglob("*") if p.is_file())
    print(f"assets trimmed: {before:,} → {after:,} bytes unpacked")

    # Keep a copy beside the zip when asked, so the verify scripts can load it.
    keep = pathlib.os.environ.get("LITE_BUILD_DIR")
    if keep:
        shutil.rmtree(keep, ignore_errors=True)
        shutil.copytree(lite, keep)

    subprocess.run(
        [sys.executable, str(pathlib.Path(__file__).with_name("package-web.py")), str(lite), str(out)],
        check=True,
    )
