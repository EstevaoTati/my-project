#!/usr/bin/env python3
"""Render the VO Nail Artist cinematic background loop.

Why this exists: the hero background is a video, and a video for a brand this
small should not be a stock clip. This builds one from the artist's own work —
the three signature sets and the monogram — as a seamless loop: slow Ken Burns
moves, cross-dissolves, a rose-gold grade, drifting gold bokeh and fine grain.

Seamlessness is the whole point. A background that visibly restarts reads as
broken, so every time-varying element (camera move, particles, light sweep,
grain) has a period that divides the loop length exactly, and the final
cross-dissolve resolves into frame 0 rather than cutting to it.

Usage:
    python3 scripts/vo-render-hero.py            # both orientations
    python3 scripts/vo-render-hero.py --fast     # half resolution, quick check

Outputs into assets/vo/:
    hero.mp4        1920x1080   desktop
    hero-portrait.mp4 1080x1920 phones
    hero-poster.jpg / hero-poster-portrait.jpg   first frame, shown until play

Requires Pillow and an ffmpeg binary (imageio-ffmpeg supplies a static one).
"""

import argparse
import math
import os
import random
import shutil
import subprocess
import sys
import tempfile

import numpy as np
from PIL import Image, ImageDraw, ImageEnhance, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "assets", "vo")
OUT = os.path.join(ROOT, "assets", "vo")

FPS = 24
SHOT_SECONDS = 4.5          # time each shot holds the frame
FADE_SECONDS = 1.25         # cross-dissolve length, overlapping the next shot

# Brand palette, sampled from the monogram artwork.
BLUSH = (247, 226, 221)
ROSE_GOLD = (183, 110, 89)
ESPRESSO = (34, 20, 18)

# Ken Burns moves: (start_scale, end_scale, start_center, end_center).
# Scales stay close to 1.0 on purpose. A background is not a hero shot: crop in
# hard and the nail art — the only thing a visitor is here to judge — leaves
# the frame. Centres stay near the middle so the narrow portrait cut still
# lands on the hand rather than on a corner of the tablecloth.
SHOTS = [
    ("nails-brown.jpg", 1.02, 1.13, (0.50, 0.46), (0.45, 0.53)),
    ("nails-blue.jpg", 1.13, 1.02, (0.54, 0.50), (0.49, 0.44)),
    ("nails-burgundy.jpg", 1.02, 1.12, (0.47, 0.50), (0.54, 0.52)),
    ("vo-logo.jpg", 1.00, 1.07, (0.50, 0.50), (0.50, 0.50)),
]


def ease(t):
    """Ease-in-out. A linear Ken Burns move looks mechanical; this breathes."""
    return t * t * (3.0 - 2.0 * t)


def load_sources(max_side):
    """Load and pre-scale the stills once, so per-frame work is just a crop."""
    out = []
    for name, *_ in SHOTS:
        path = os.path.join(SRC, name)
        if not os.path.exists(path):
            sys.exit(f"missing source image: {path}")
        img = Image.open(path).convert("RGB")
        scale = max_side / max(img.size)
        if scale > 1:
            img = img.resize(
                (round(img.width * scale), round(img.height * scale)),
                Image.LANCZOS,
            )
        out.append(img)
    return out


def kenburns(img, w, h, scale, cx, cy):
    """Crop a scale/centre window out of `img` and fit it to w x h."""
    target = w / h
    # Largest w:h window that fits inside the source, then divided by scale.
    if img.width / img.height > target:
        ch = img.height / scale
        cw = ch * target
    else:
        cw = img.width / scale
        ch = cw / target

    # Clamp the centre so the window never runs off the source edge.
    x = min(max(cx * img.width - cw / 2, 0), img.width - cw)
    y = min(max(cy * img.height - ch / 2, 0), img.height - ch)
    box = (round(x), round(y), round(x + cw), round(y + ch))
    return img.resize((w, h), Image.LANCZOS, box=box)


_LOGO_MASK = {}


def _logo_mask(side):
    """Soft circular mask, cached per size.

    The monogram ships as a square JPEG on a blush field. Pasting that square
    onto a blush plate still showed its outline: the file's own corners are a
    shade lighter than any flat colour behind them, and JPEG edges do not
    blend. Feathering it into a disc removes the seam and suits the artwork,
    which is drawn inside a circle to begin with.
    """
    if side not in _LOGO_MASK:
        m = Image.new("L", (side, side), 0)
        ImageDraw.Draw(m).ellipse(
            [side * 0.018, side * 0.018, side * 0.982, side * 0.982], fill=255
        )
        _LOGO_MASK[side] = m.filter(ImageFilter.GaussianBlur(side * 0.035))
    return _LOGO_MASK[side]


def logo_plate(img, w, h, scale):
    """Centre the monogram on a soft blush field matching its own background."""
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    r = np.sqrt(
        ((xx / max(w - 1, 1) - 0.5) * 2) ** 2 + ((yy / max(h - 1, 1) - 0.5) * 2) ** 2
    )
    k = np.clip(r / 1.35, 0, 1)[..., None] ** 1.4
    base = np.array(BLUSH, np.float32) * (1 - k) + np.array((226, 186, 178), np.float32) * k
    plate = Image.fromarray(base.astype(np.uint8), "RGB")

    side = round(min(w, h) * 0.80 * scale)
    mark = img.resize((side, side), Image.LANCZOS)
    plate.paste(mark, ((w - side) // 2, (h - side) // 2), _logo_mask(side))
    return plate


def build_overlays(w, h):
    """Pre-render everything that does not change between frames.

    Both gradients are computed as continuous functions rather than drawn as
    stacked shapes. The first cut of this file stepped through ellipses and
    switched tint colour at the halfway line, which left a visible horizontal
    seam straight across the frame and crushed the picture into mud.
    """
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    nx = (xx / max(w - 1, 1) - 0.5) * 2.0
    ny = (yy / max(h - 1, 1) - 0.5) * 2.0
    vy = ny / max(h / w, 1.0) if w < h else ny  # keep the falloff round-ish

    # Vignette: gentle. The page lays its own scrim over this video for text
    # contrast, so baking a heavy one in here only makes the artwork dull.
    r = np.sqrt(nx * nx + vy * vy)
    fall = np.clip((r - 0.62) / 0.78, 0.0, 1.0) ** 1.5
    vignette = Image.fromarray(
        np.dstack(
            [np.full((h, w), c, np.uint8) for c in ESPRESSO]
            + [(fall * 132).astype(np.uint8)]
        ),
        "RGBA",
    )

    # Wash: one continuous ramp from warm rose at the top to espresso at the
    # bottom, so the two tints never meet at an edge.
    t = (yy / max(h - 1, 1)).astype(np.float32)
    mix = t[..., None] ** 1.3
    rose = np.array(ROSE_GOLD, np.float32)
    esp = np.array(ESPRESSO, np.float32)
    colour = rose * (1 - mix) + esp * mix
    alpha = 34.0 + 92.0 * t ** 2.4 + 26.0 * (1 - t) ** 3.5
    wash = Image.fromarray(
        np.dstack([colour.astype(np.uint8), alpha.astype(np.uint8)]), "RGBA"
    )

    # Bokeh sprites, pre-blurred once and pasted per frame — drawing and
    # blurring circles on every frame is what makes naive renderers crawl.
    sprites = []
    for radius in (round(min(w, h) * r) for r in (0.008, 0.014, 0.022, 0.034)):
        size = radius * 4
        s = Image.new("RGBA", (size, size), (0, 0, 0, 0))
        sd = ImageDraw.Draw(s)
        sd.ellipse([size / 2 - radius, size / 2 - radius, size / 2 + radius, size / 2 + radius],
                   fill=(255, 230, 210, 150))
        sprites.append(s.filter(ImageFilter.GaussianBlur(radius * 0.55)))

    return vignette, wash, sprites


def build_particles(count, seed=7):
    rnd = random.Random(seed)
    return [
        {
            "x": rnd.random(),
            "y": rnd.random(),
            "sprite": rnd.randrange(4),
            # Whole-number drift per loop keeps the motion seamless.
            "laps": rnd.choice([1, 1, 2]),
            "sway": rnd.uniform(0.012, 0.05),
            "phase": rnd.uniform(0, math.tau),
            "alpha": rnd.uniform(0.14, 0.44),
        }
        for _ in range(count)
    ]


def grain_tiles(w, h, n=10, seed=3):
    """A short cycle of noise tiles. Fresh noise per frame would not loop, and
    a single static tile reads as a dirty lens rather than film."""
    random.seed(seed)
    tiles = []
    for _ in range(n):
        small = Image.effect_noise((w // 5, h // 5), 22).convert("L")
        tiles.append(small.resize((w, h), Image.BILINEAR))
    return tiles


def render(w, h, out_path, poster_path, ffmpeg, fast=False):
    n_shots = len(SHOTS)
    shot_frames = round(SHOT_SECONDS * FPS)
    fade_frames = round(FADE_SECONDS * FPS)
    total = shot_frames * n_shots

    sources = load_sources(max(w, h) * (1.2 if fast else 1.8))
    vignette, wash, sprites = build_overlays(w, h)
    particles = build_particles(34 if fast else 54)
    tiles = grain_tiles(w, h, n=10)

    def shot_frame(index, local):
        """Render shot `index` at local frame `local`, which may be negative:
        a shot starts moving before the previous one has finished fading out."""
        name, s0, s1, c0, c1 = SHOTS[index]
        p = ease((local + fade_frames) / (shot_frames + fade_frames))
        scale = s0 + (s1 - s0) * p
        img = sources[index]
        if name.startswith("vo-logo"):
            return logo_plate(img, w, h, scale / s0 * 1.0)
        cx = c0[0] + (c1[0] - c0[0]) * p
        cy = c0[1] + (c1[1] - c0[1]) * p
        return kenburns(img, w, h, scale, cx, cy)

    tmp = tempfile.mkdtemp(prefix="vo-hero-")
    try:
        for f in range(total):
            idx = f // shot_frames
            local = f - idx * shot_frames

            frame = shot_frame(idx, local)
            if local >= shot_frames - fade_frames:
                nxt = (idx + 1) % n_shots
                alpha = (local - (shot_frames - fade_frames)) / fade_frames
                frame = Image.blend(frame, shot_frame(nxt, local - shot_frames), ease(alpha))

            # Grade: pull a little saturation out, lift warmth, then wash.
            frame = ImageEnhance.Color(frame).enhance(1.04)
            frame = ImageEnhance.Contrast(frame).enhance(1.04)
            frame = ImageEnhance.Brightness(frame).enhance(1.05)
            frame = frame.convert("RGBA")
            frame.alpha_composite(wash)

            # Bokeh. Positions wrap exactly once (or twice) per loop.
            t = f / total
            layer = Image.new("RGBA", (w, h), (0, 0, 0, 0))
            for p_ in particles:
                sprite = sprites[p_["sprite"]]
                y = (p_["y"] - t * p_["laps"]) % 1.0
                x = (p_["x"] + p_["sway"] * math.sin(math.tau * t * p_["laps"] + p_["phase"])) % 1.0
                a = p_["alpha"] * (0.55 + 0.45 * math.sin(math.tau * t * p_["laps"] + p_["phase"]))
                if a <= 0.02:
                    continue
                s = sprite if a > 0.99 else sprite.copy()
                if a <= 0.99:
                    s.putalpha(s.getchannel("A").point(lambda v, a=a: int(v * a)))
                layer.alpha_composite(s, (round(x * w - s.width / 2), round(y * h - s.height / 2)))
            frame.alpha_composite(layer)

            # Light sweep: one slow pass of warm sheen per loop.
            sweep_x = (t * 1.6 - 0.3) % 1.6 - 0.3
            sweep = Image.new("RGBA", (w, h), (0, 0, 0, 0))
            sd = ImageDraw.Draw(sweep)
            band = w * 0.20
            for i in range(14):
                k = i / 13
                sd.polygon(
                    [
                        (sweep_x * w + band * k - band / 2, 0),
                        (sweep_x * w + band * k, h),
                        (sweep_x * w + band * (k + 0.09), h),
                        (sweep_x * w + band * (k + 0.09) - band / 2, 0),
                    ],
                    fill=(255, 232, 214, int(22 * math.sin(math.pi * k))),
                )
            frame.alpha_composite(sweep.filter(ImageFilter.GaussianBlur(w * 0.02)))

            frame.alpha_composite(vignette)

            rgb = frame.convert("RGB")
            # Grain, at ~7% — enough to kill banding in the gradients.
            rgb = Image.blend(rgb, Image.merge("RGB", (tiles[f % len(tiles)],) * 3), 0.07)

            if f == 0:
                rgb.save(poster_path, "JPEG", quality=86, optimize=True, progressive=True)
            rgb.save(os.path.join(tmp, f"f{f:05d}.png"), compress_level=1)

            if f % 48 == 0:
                print(f"  {w}x{h}  frame {f}/{total}", flush=True)

        print(f"  encoding {os.path.basename(out_path)} …", flush=True)
        subprocess.run(
            [
                ffmpeg, "-y", "-loglevel", "error",
                "-framerate", str(FPS), "-i", os.path.join(tmp, "f%05d.png"),
                "-c:v", "libx264", "-profile:v", "high", "-pix_fmt", "yuv420p",
                "-preset", "slow" if not fast else "fast",
                "-crf", "27", "-g", str(FPS * 2), "-an",
                "-movflags", "+faststart",
                out_path,
            ],
            check=True,
        )
    finally:
        shutil.rmtree(tmp, ignore_errors=True)

    size = os.path.getsize(out_path) / 1e6
    print(f"  wrote {out_path}  ({size:.2f} MB, {total / FPS:.1f}s)")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--fast", action="store_true", help="half resolution draft")
    ap.add_argument("--landscape-only", action="store_true")
    args = ap.parse_args()

    try:
        import imageio_ffmpeg

        ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()
    except ImportError:
        ffmpeg = shutil.which("ffmpeg")
    if not ffmpeg:
        sys.exit("ffmpeg not found — pip install imageio-ffmpeg")

    os.makedirs(OUT, exist_ok=True)
    d = 2 if args.fast else 1

    render(1920 // d, 1080 // d, os.path.join(OUT, "hero.mp4"),
           os.path.join(OUT, "hero-poster.jpg"), ffmpeg, args.fast)

    if not args.landscape_only:
        render(1080 // d, 1920 // d, os.path.join(OUT, "hero-portrait.mp4"),
               os.path.join(OUT, "hero-poster-portrait.jpg"), ffmpeg, args.fast)


if __name__ == "__main__":
    main()
