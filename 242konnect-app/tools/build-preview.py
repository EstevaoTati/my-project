#!/usr/bin/env python3
"""Fold the built app into one self-contained preview page.

An Artifact runs under a CSP that blocks every external host, so the JS, the
fonts and the images all have to travel inside the document. The fonts are not
optional: the app gates its first paint on useFonts, so a font that fails to
load leaves a permanently blank screen.

The JS inlines as text (no base64 inflation). Images and fonts become data URIs
and the asset URLs baked into the bundle are swapped for them.
"""

import base64
import io
import os
import pathlib
import re
from PIL import Image

# Defaults resolve from this file, so the script works from any checkout.
REPO = pathlib.Path(__file__).resolve().parents[2]
BUILD = pathlib.Path(os.environ.get("BUILD_DIR", REPO / "242konnect-web"))
OUT = pathlib.Path(os.environ.get("OUT_FILE", REPO / "242konnect-app" / "dist-preview" / "242konnect.html"))

# The app renders in a 390 px frame at up to 2x, so nothing needs to be wider
# than ~800 px. The design's source photos are far larger.
MAX_WIDTH = 800
JPEG_QUALITY = 78
MIME = {".ttf": "font/ttf", ".png": "image/png", ".jpeg": "image/jpeg", ".jpg": "image/jpeg"}

# The charte's typefaces, used by the page chrome around the phone. They must
# match src/theme.ts — Manrope for titles, Inter for text.
CHROME_FONTS = {
    "Manrope": (700, "manrope/700Bold"),
    "Inter400": (400, "inter/400Regular"),
    "Inter600": (600, "inter/600SemiBold"),
}


def data_uri(path: pathlib.Path) -> str:
    raw = path.read_bytes()
    if path.suffix.lower() in (".jpeg", ".jpg", ".png"):
        try:
            img = Image.open(io.BytesIO(raw))
            if img.width > MAX_WIDTH:
                img = img.resize((MAX_WIDTH, round(img.height * MAX_WIDTH / img.width)), Image.LANCZOS)
            buf = io.BytesIO()
            if path.suffix.lower() == ".png" and img.mode in ("RGBA", "LA", "P"):
                img.save(buf, "PNG", optimize=True)
                mime = "image/png"
            else:
                img.convert("RGB").save(buf, "JPEG", quality=JPEG_QUALITY, optimize=True)
                mime = "image/jpeg"
            if buf.tell() < len(raw):
                return f"data:{mime};base64," + base64.b64encode(buf.getvalue()).decode()
        except Exception:
            pass
    return f"data:{MIME.get(path.suffix.lower(), 'application/octet-stream')};base64," + base64.b64encode(raw).decode()


def find_font(fragment: str) -> pathlib.Path:
    matches = [p for p in BUILD.rglob("*.ttf") if fragment in str(p)]
    if not matches:
        raise SystemExit(f"font not found in build: {fragment}")
    return matches[0]


def main():
    js_files = sorted((BUILD / "_expo").rglob("*.js"))
    if len(js_files) != 1:
        raise SystemExit(f"expected one bundle, found {len(js_files)}")
    bundle = js_files[0].read_text()

    refs = sorted(set(re.findall(r'"(assets/[^"]+)"', bundle)))
    swapped = 0
    for ref in refs:
        asset = BUILD / ref
        if asset.exists():
            bundle = bundle.replace(f'"{ref}"', '"' + data_uri(asset) + '"')
            swapped += 1
    leftover = re.findall(r'"assets/[^"]+"', bundle)
    if leftover:
        raise SystemExit(f"ERROR: {len(leftover)} asset refs unresolved: {leftover[:3]}")

    # </script> inside the bundle text would close the tag early.
    bundle = bundle.replace("</script>", "<\\/script>")

    faces = []
    for family, (weight, fragment) in CHROME_FONTS.items():
        name = "Manrope" if family == "Manrope" else "Inter"
        b64 = base64.b64encode(find_font(fragment).read_bytes()).decode()
        faces.append(
            f"@font-face{{font-family:'{name}';font-style:normal;font-weight:{weight};"
            f"font-display:swap;src:url(data:font/ttf;base64,{b64}) format('truetype');}}"
        )

    page = PAGE.replace("/*FONT_FACES*/", "\n".join(faces)).replace("/*BUNDLE*/", bundle)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(page)
    print(f"inlined {swapped}/{len(refs)} assets")
    print(f"wrote {OUT} ({OUT.stat().st_size / 1024 / 1024:.2f} MB)")


PAGE = r"""<title>242Konnect</title>
<style>
/*FONT_FACES*/

/* The page IS the app — no landing copy above it, so a shared link opens
   straight into 242Konnect. Everything the viewer needs to know about what is
   and isn't real lives inside the app's own FAQ, where it belongs.

   Ground colours come from the product's tokens so the surround and the screen
   belong to one system. */
:root { --ground: #e6eaf0; --frame: #1e293b; color-scheme: light; }
@media (prefers-color-scheme: dark) {
  :root { --ground: #070c16; --frame: #05080f; color-scheme: dark; }
}
:root[data-theme="dark"] { --ground: #070c16; --frame: #05080f; color-scheme: dark; }
:root[data-theme="light"] { --ground: #e6eaf0; --frame: #1e293b; color-scheme: light; }

html, body { height: 100%; }
body {
  margin: 0; background: var(--ground); overflow: hidden;
  font-family: Inter, ui-sans-serif, system-ui, sans-serif;
  -webkit-font-smoothing: antialiased;
}

.stage {
  height: 100dvh; display: flex; align-items: center; justify-content: center;
}

/* transform makes this a containing block, so the app's fixed bars and its
   modal portals stay inside the phone instead of escaping to the viewport.
   Load-bearing — see the script below. */
.phone {
  width: 390px;
  /* Never taller than the window, so the frame fits a laptop without scaling. */
  height: min(844px, 100dvh);
  flex: none; position: relative;
  transform: translateZ(0); overflow: hidden;
  border-radius: 44px; background: #f8fafc;
  border: 11px solid var(--frame);
  box-shadow: 0 40px 80px -24px rgb(15 23 42 / 0.45), 0 0 0 1px rgb(15 23 42 / 0.06);
}
#root { display: flex; height: 100%; flex: 1; }

/* react-native-web renders Modal into a portal appended to document.body, so a
   sheet would otherwise stretch across the whole window instead of the phone.
   Moving the node breaks React (it later calls removeChild against body and
   throws), so instead the portal root is pinned over the phone and given a
   transform, which makes it the containing block for the fixed layers inside.
   Geometry is duplicated from .phone deliberately: pure CSS tracks resizing
   with no JS, and the marker attribute is only set while a modal is mounted. */
body > div[data-portal] {
  position: fixed; left: 50%; top: 50%;
  width: 390px; height: min(844px, 100dvh);
  transform: translate(-50%, -50%) translateZ(0);
  overflow: hidden;
  border-radius: 33px; /* .phone radius minus its border width */
  pointer-events: none;
}
body > div[data-portal] > * { pointer-events: auto; }
@media (max-width: 700px) {
  body > div[data-portal] { width: 100dvw; height: 100dvh; border-radius: 0; }
}

/* On a phone the frame is just wasted pixels — hand the whole viewport to the
   app so a shared link behaves like the real thing. */
@media (max-width: 700px) {
  .phone {
    width: 100dvw; height: 100dvh;
    border-width: 0; border-radius: 0; box-shadow: none;
  }
}
@media (prefers-reduced-motion: reduce) { * { animation: none !important; transition: none !important; } }
</style>

<div class="stage"><div class="phone"><div id="root"></div></div></div>

<script>
// Marks a body-level portal root while it actually holds a modal, so the CSS
// above can pin it over the phone. Deliberately does not re-parent anything:
// React appended these to body and will remove them from body, and moving them
// makes that removal throw. One observer on body picks up new roots, one per
// root tracks whether it currently has content.
(function () {
  var stage = document.querySelector('.stage');
  if (!stage || !window.MutationObserver) return;
  var sync = function (n) {
    if (n.childElementCount > 0) n.setAttribute('data-portal', '');
    else n.removeAttribute('data-portal');
  };
  var watch = function (n) {
    if (n.nodeType !== 1 || n.tagName !== 'DIV' || n === stage || n.__watched) return;
    n.__watched = true;
    sync(n);
    new MutationObserver(function () { sync(n); }).observe(n, { childList: true });
  };
  new MutationObserver(function (recs) {
    recs.forEach(function (r) { Array.prototype.forEach.call(r.addedNodes, watch); });
  }).observe(document.body, { childList: true });
  Array.prototype.forEach.call(document.body.children, watch);
})();
</script>

<script>
/*BUNDLE*/
</script>
"""


if __name__ == "__main__":
    main()
