#!/usr/bin/env python3
"""Render the MWINDA DIGITAL background loop from the brand's own images.

    python3 scripts/render-brand-loop.py            # both masters
    python3 scripts/render-brand-loop.py landscape  # one of them

Why this exists rather than only an AI clip
-------------------------------------------
Video models cannot be trusted with lettering: asked to show "MWINDA DIGITAL"
they redraw it, and a background that misspells the brand on every loop is
worse than no background. Here the wordmark is the founder's own logo file,
composited, so it is exact in every frame. The scenes are the founder's own
brand images. Nothing is generated.

It also solves what a single 16:9 clip cannot: a phone in portrait crops a
landscape video to a narrow strip. So there are two masters — landscape for
desktop, portrait for phones — and the page picks one with <source media>.

The loop is seamless by construction: the last frame is the first frame, and
the camera eases to a stop on both sides of the seam, so there is no jump in
position or in speed when it wraps.

Scenario (20 s, 24 fps, silent) — "Bringing Light to Your Ideas":
   0 –  3  ignition    the logo; a band of gold light crosses it
   3 –  7  the house   the Mwinda reception, slow push-in
   7 – 11  the work    the brand across devices, lateral drift
  11 – 15  the mind    AI dashboards, push toward the holograms
  15 – 18  the reach   the data globe, slow pull-back
  18 – 20  return      back to the logo, easing to rest on frame 0

Needs Pillow and an ffmpeg binary (FFMPEG env var, or ffmpeg on PATH).
"""
import os
import subprocess
import sys

from PIL import Image, ImageChops, ImageDraw, ImageEnhance, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "docs", "brand-source")
OUT = os.path.join(ROOT, "assets")
FFMPEG = os.environ.get("FFMPEG", "ffmpeg")

FPS = 24
DURATION = 20.0
FRAMES = int(FPS * DURATION)
XFADE = 0.8          # crossfade length between scenes, seconds
OVERSCAN = 1.22      # plates are built larger than the frame so zooms stay sharp

MASTERS = {
    # name: (width, height, crf) — the phone master is lighter: it travels
    # over mobile data, and 720 px wide is still ~2x density on a phone.
    "landscape": (1920, 1080, 27),
    "portrait": (720, 1280, 28),
}

# (source file, start, end, motion) — times are where the scene is fully in.
SCENES = [
    ("mwinda-logo.png",   0.0,  3.0, "logo-in"),
    ("scene-office.png",  3.0,  7.0, "push"),
    ("scene-devices.png", 7.0, 11.0, "pan"),
    ("scene-ai-desk.jpg", 11.0, 15.0, "push-up"),
    ("scene-globe.jpg",  15.0, 18.0, "pull"),
    ("mwinda-logo.png",  18.0, 20.0, "logo-out"),
]


def ease(p):
    """Smoothstep: zero velocity at both ends — what makes the loop seam invisible."""
    p = max(0.0, min(1.0, p))
    return p * p * (3 - 2 * p)


# ------------------------------------------------------------------ plates --
# The tagline's band in mwinda-logo.png (1774x887): glyphs sit on rows
# 658-694, x 310-1445, between DIGITAL (ends ~612) and the frame (~748).
TAGLINE_BAND = (280, 650, 1495, 704)


def erase_tagline(logo):
    """The logo without "BRINGING LIGHT TO YOUR IDEAS".

    The hero headline already says it, and on a phone the small tagline sat
    under the hero copy: only "TO YOUR" showed between the lines, which read
    as a broken fragment. Each column of the band is refilled by interpolating
    between the clean rows just above and below it, so the plate's gradient
    carries through with no patch to see.
    """
    x0, y0, x1, y1 = TAGLINE_BAND
    logo = logo.copy()
    px = logo.load()
    span = y1 - y0
    for x in range(x0, x1):
        top, bot = px[x, y0], px[x, y1]
        for y in range(y0 + 1, y1):
            t = (y - y0) / span
            px[x, y] = tuple(round(a + (b - a) * t) for a, b in zip(top, bot))
    return logo


def logo_plate(w, h, landscape):
    """The logo on black, placed where the page's headline is NOT.

    This loop plays behind the hero, and the hero leads with "Bringing Light
    to Your Ideas" — the logo's own tagline. Centred behind the headline, the
    two copies stacked on each other and the text lost its contrast; the
    tagline is erased from the plate (see erase_tagline).

    Landscape: the headline owns the left column, so the logo stands on the
    right. Portrait: a phone hero is text from top to bottom — there is no free
    band — so the logo stays centred but dims to ambience. The nav already
    carries the crisp wordmark on every page.

    Returns the plate and the logo's box on it, for the light sweep.
    """
    logo = erase_tagline(Image.open(os.path.join(SRC, "mwinda-logo.png")).convert("RGB"))
    pw, ph = round(w * OVERSCAN), round(h * OVERSCAN)
    # The logo file's own corners, so the canvas and the logo share one black.
    plate = Image.new("RGB", (pw, ph), (9, 9, 10))

    # Placement is given in FRAME terms — what the viewer sees at zoom 1 — and
    # converted to the oversized plate. Placing it in plate terms put the logo
    # against the frame edge, and the browser's cover crop then cut it off.
    # Margins leave room for a 16:10 screen and the 10% zoom of the loop.
    if landscape:
        fw_, fcx, fcy = 0.30, 0.75, 0.50     # right of the headline column
    else:
        fw_, fcx, fcy = 0.74, 0.50, 0.46     # clear of a phone's ~9% side crop
        logo = ImageEnhance.Brightness(logo).enhance(0.62)
    margin = (OVERSCAN - 1) / 2
    lw = round(w * fw_)
    lh = round(lw * logo.height / logo.width)
    cx = (margin * w + fcx * w)
    cy = (margin * h + fcy * h)
    logo = logo.resize((lw, lh), Image.LANCZOS)

    # The logo's gold glow runs to the edges of its file; a hard paste cuts it
    # into a visible box. Feather every edge into the canvas instead.
    feather = round(lw * 0.08)
    mask = Image.new("L", (lw, lh), 0)
    ImageDraw.Draw(mask).rectangle([feather, feather, lw - feather, lh - feather], fill=255)
    mask = mask.filter(ImageFilter.GaussianBlur(feather / 2))

    x, y = round(cx - lw / 2), round(cy - lh / 2)
    plate.paste(logo, (x, y), mask)
    return plate, (x, y, x + lw, y + lh)


def scene_plate(path, w, h, landscape):
    """A brand image framed for the master.

    Landscape: the portrait image stands whole in the centre, and the sides are
    a blurred, darkened extension of itself with a feathered seam — never a
    black letterbox, never a crop through the subject.
    Portrait: the image simply fills the frame; it was portrait to begin with.
    """
    im = Image.open(path).convert("RGB")
    pw, ph = round(w * OVERSCAN), round(h * OVERSCAN)
    if not landscape:
        s = max(pw / im.width, ph / im.height)
        im = im.resize((round(im.width * s), round(im.height * s)), Image.LANCZOS)
        x, y = (im.width - pw) // 2, (im.height - ph) // 2
        return im.crop((x, y, x + pw, y + ph))

    # Background: cover-fit, heavy blur, pulled down so it reads as atmosphere.
    s = max(pw / im.width, ph / im.height)
    bg = im.resize((round(im.width * s), round(im.height * s)), Image.LANCZOS)
    x, y = (bg.width - pw) // 2, (bg.height - ph) // 2
    bg = bg.crop((x, y, x + pw, y + ph)).filter(ImageFilter.GaussianBlur(46))
    bg = ImageEnhance.Brightness(bg).enhance(0.42)
    bg = ImageEnhance.Color(bg).enhance(0.9)

    # Foreground: the whole image, full height.
    fh = ph
    fw = round(im.width * fh / im.height)
    fg = im.resize((fw, fh), Image.LANCZOS)

    # Feather the left and right edges into the background.
    feather = round(fw * 0.14)
    mask = Image.new("L", (fw, fh), 255)
    draw = ImageDraw.Draw(mask)
    for i in range(feather):
        a = round(255 * ease(i / feather))
        draw.line([(i, 0), (i, fh)], fill=a)
        draw.line([(fw - 1 - i, 0), (fw - 1 - i, fh)], fill=a)
    bg.paste(fg, ((pw - fw) // 2, 0), mask)
    return bg


def sweep_mask(size, box):
    """Confine the sweep to the logo, feathered — a gold band crossing the
    headline, even briefly, costs the text its contrast."""
    pw, ph = size
    x0, y0, x1, y1 = box
    pad = round((x1 - x0) * 0.06)
    mask = Image.new("L", (pw, ph), 0)
    ImageDraw.Draw(mask).rectangle([x0 - pad, y0 - pad, x1 + pad, y1 + pad], fill=255)
    return mask.filter(ImageFilter.GaussianBlur(pad))


def sweep_band(w, h):
    """A diagonal band of warm light, wider than the frame, to slide across the logo."""
    bw = w * 3
    band = Image.new("RGB", (bw, h), (0, 0, 0))
    draw = ImageDraw.Draw(band)
    # A sheen, not a stripe: wide, soft, and brightest in a narrow core.
    centre, half = bw // 2, round(w * 0.16)
    for dx in range(-half, half + 1):
        a = ease(1 - abs(dx) / half) ** 1.6
        col = (round(255 * a * 0.62), round(205 * a * 0.62), round(95 * a * 0.62))
        draw.line([(centre + dx - h // 2, 0), (centre + dx + h // 2, h)], fill=col, width=2)
    return band.filter(ImageFilter.GaussianBlur(max(6, w // 36)))


# ----------------------------------------------------------------- framing --
def framed(plate, w, h, zoom, fx=0.5, fy=0.5):
    """Crop a zoomed window out of a plate. zoom=1 shows the frame-sized centre;
    fx/fy (0..1) slide the window across the spare margin."""
    cw, ch = plate.width / (OVERSCAN * zoom), plate.height / (OVERSCAN * zoom)
    x = (plate.width - cw) * fx
    y = (plate.height - ch) * fy
    return plate.transform((w, h), Image.EXTENT, (x, y, x + cw, y + ch), Image.BICUBIC)


def scene_frame(kind, plate, sweep, w, h, p, t):
    """One frame of a scene at local progress p (0..1)."""
    e = ease(p)
    if kind == "logo-in":
        # The light crosses between 0.5 s and 2.3 s, never on frame 0, and only
        # over the logo. Applied to the plate before framing, so it rides the zoom.
        s = (t - 0.5) / 1.8
        if 0.0 <= s <= 1.0:
            band, mask = sweep
            off = round((band.width - plate.width) * (1 - ease(s)))
            light = band.crop((off, 0, off + plate.width, plate.height))
            lit = ImageChops.screen(plate, light)
            plate = Image.composite(lit, plate, mask)
        # Rests at exactly zoom 1.00 on frame 0 — the seam partner of logo-out.
        return framed(plate, w, h, 1.0 + 0.07 * e)
    if kind == "logo-out":
        # Eases out to zoom 1.00 at t = 20 s, i.e. frame 0 of the next loop.
        return framed(plate, w, h, 1.10 - 0.10 * e)
    if kind == "push":
        return framed(plate, w, h, 1.0 + 0.10 * e, 0.5, 0.5 - 0.08 * e)
    if kind == "pan":
        return framed(plate, w, h, 1.08, 0.2 + 0.6 * e, 0.5)
    if kind == "push-up":
        return framed(plate, w, h, 1.02 + 0.11 * e, 0.5, 0.42 - 0.12 * e)
    if kind == "pull":
        return framed(plate, w, h, 1.14 - 0.12 * e, 0.5, 0.5)
    raise ValueError(kind)


# ------------------------------------------------------------------ render --
def render(name):
    w, h, crf = MASTERS[name]
    landscape = w > h
    print(f"[{name}] building plates {w}x{h}", flush=True)
    plates, sweep = [], None
    for src, start, end, kind in SCENES:
        if kind.startswith("logo"):
            plate, box = logo_plate(w, h, landscape)
            plates.append(plate)
            if sweep is None:
                sweep = (sweep_band(plate.width, plate.height), sweep_mask(plate.size, box))
        else:
            plates.append(scene_plate(os.path.join(SRC, src), w, h, landscape))

    out = os.path.join(OUT, f"mwinda-loop-{name}.mp4")
    cmd = [FFMPEG, "-hide_banner", "-loglevel", "error", "-y",
           "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{w}x{h}", "-r", str(FPS), "-i", "-",
           "-an", "-c:v", "libx264", "-profile:v", "main", "-level", "4.0",
           "-pix_fmt", "yuv420p", "-preset", "slow", "-crf", str(crf),
           "-tune", "film", "-movflags", "+faststart", out]
    enc = subprocess.Popen(cmd, stdin=subprocess.PIPE)

    half = XFADE / 2
    for f in range(FRAMES):
        t = f / FPS
        layers = []
        for i, (src, start, end, kind) in enumerate(SCENES):
            # The first scene has no fade-in and the last no fade-out: the loop
            # seam is a cut from a frame to itself, not a crossfade.
            lo = start - (0 if i == 0 else half)
            hi = end + (0 if i == len(SCENES) - 1 else half)
            if lo <= t <= hi:
                p = (t - lo) / (hi - lo)
                a = 1.0
                if i > 0 and t < start + half:
                    a = ease((t - (start - half)) / XFADE)
                layers.append((a, scene_frame(kind, plates[i], sweep, w, h, p, t)))
        frame = layers[0][1]
        for a, img in layers[1:]:
            frame = Image.blend(frame, img, a)
        enc.stdin.write(frame.tobytes())
        if f % 48 == 0:
            print(f"[{name}] {t:5.1f}s", flush=True)
    enc.stdin.close()
    if enc.wait() != 0:
        sys.exit(f"ffmpeg failed for {name}")
    print(f"[{name}] wrote {out} ({os.path.getsize(out) / 1048576:.2f} MB)", flush=True)


if __name__ == "__main__":
    for n in (sys.argv[1:] or list(MASTERS)):
        render(n)
