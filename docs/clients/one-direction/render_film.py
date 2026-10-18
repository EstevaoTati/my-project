#!/usr/bin/env python3
"""ONE DIRECTION — "Where Destinies Are Made". Motion-design master renderer.

    python3 render_film.py landscape            # 1920x1080, 24 fps
    python3 render_film.py portrait             # 1080x1920 (recomposed, not cropped)
    python3 render_film.py square45             # 1080x1350 (4:5)
    python3 render_film.py landscape --still 80 # one frame at t=80 s, for checks

Every letter on screen is either the client's own logo file or set in a real
font. Video models cannot be trusted with lettering, so nothing typographic is
generated. Live-action moments (scenes 02, 04, end of 05) are PLATE slots: a
still or frame folder dropped into plates/<id>.(jpg|png) is used with a slow
push-in; without one the slot renders a labelled slate, so the film is
always complete and the edit always shows what is still owed.

The yellow line is the one recurring device: it is the first light in scene
01, the beam in 03, the wipe between plates in 02/04, the lit road in 06 and
the stroke that resolves into the logo in 07.
"""
import math
import os
import subprocess
import sys
from functools import lru_cache
from multiprocessing import Pool

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
FONT = {w: os.path.join(HERE, "fonts", f"mont-{w}.ttf") for w in (300, 500, 700, 800)}
FPS = 24
DUR = 88.0

YELLOW = np.array([255, 212, 0], np.float32) / 255      # brief: #FFD400
LOGO_YELLOW = (250, 230, 4)                              # measured from the logo file
WHITE = np.array([1, 1, 1], np.float32)
BLACK = np.array([8, 8, 8], np.float32) / 255            # #080808

FORMATS = {"landscape": (1920, 1080), "portrait": (1080, 1920), "square45": (1080, 1350)}
W, H = FORMATS["landscape"]


# ---------------------------------------------------------------- utilities
def clamp(x, a=0.0, b=1.0):
    return max(a, min(b, x))


def seg(t, a, b):
    return clamp((t - a) / (b - a)) if b > a else float(t >= a)


def smooth(p):
    return p * p * (3 - 2 * p)


def out_cubic(p):
    return 1 - (1 - p) ** 3


def in_cubic(p):
    return p ** 3


def inout(p):
    return 4 * p ** 3 if p < 0.5 else 1 - (-2 * p + 2) ** 3 / 2


def window(t, a, b, fi=0.4, fo=0.4):
    """1 inside [a,b] with fades of fi/fo seconds."""
    return smooth(seg(t, a, a + fi)) * (1 - smooth(seg(t, b - fo, b)))


def lerp(a, b, p):
    return a + (b - a) * p


S = lambda: min(W, H) / 1080.0          # layout unit: 1.0 = 1080 px short side
PORTRAIT = lambda: H > W


class Frame:
    """Float RGB frame plus an emissive layer that gets bloom."""

    def __init__(self):
        self.base = np.zeros((H, W, 3), np.float32)
        self.base[:] = BLACK
        self.glow = Image.new("RGB", (W, H))
        self.gd = ImageDraw.Draw(self.glow)

    def over(self, rgba, x, y, alpha=1.0, tint=None):
        """Composite an RGBA PIL image with its top-left at (x, y)."""
        if alpha <= 0.003:
            return
        x, y = int(round(x)), int(round(y))
        a = np.asarray(rgba, np.float32) / 255
        h, w = a.shape[:2]
        x0, y0, x1, y1 = max(x, 0), max(y, 0), min(x + w, W), min(y + h, H)
        if x1 <= x0 or y1 <= y0:
            return
        sub = a[y0 - y:y1 - y, x0 - x:x1 - x]
        col = sub[..., :3] if tint is None else np.broadcast_to(tint, sub[..., :3].shape)
        m = sub[..., 3:4] * alpha
        reg = self.base[y0:y1, x0:x1]
        reg[:] = reg * (1 - m) + col * m

    def add(self, arr, strength=1.0):
        self.base += arr * strength

    def finish(self, t, bloom=1.0, grain=0.025, vignette=0.55, fade=1.0):
        g = np.asarray(self.glow, np.float32) / 255
        small = self.glow.resize((W // 4, H // 4), Image.BILINEAR)
        b1 = np.asarray(small.filter(ImageFilter.GaussianBlur(3 * S() + 1)).resize((W, H), Image.BILINEAR), np.float32) / 255
        b2 = np.asarray(small.filter(ImageFilter.GaussianBlur(14 * S() + 2)).resize((W, H), Image.BILINEAR), np.float32) / 255
        img = self.base + g + bloom * (0.9 * b1 + 0.8 * b2)
        img *= vignette_mask(vignette)[..., None]
        rng = np.random.default_rng(int(t * FPS) + 7)
        img += (rng.standard_normal((H // 2, W // 2, 1)).astype(np.float32) * grain).repeat(2, 0).repeat(2, 1)
        img = img * fade
        # gentle filmic shoulder so stacked glows roll off instead of clipping
        hi = img > 0.85
        img[hi] = 0.85 + 0.15 * np.tanh((img[hi] - 0.85) / 0.15)
        return (np.clip(img, 0, 1) * 255).astype(np.uint8)


@lru_cache(maxsize=4)
def vignette_mask(k):
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    d = np.sqrt(((xx - W / 2) / (W / 2)) ** 2 + ((yy - H / 2) / (H / 2)) ** 2) / math.sqrt(2)
    return (1 - k * d ** 2.2).astype(np.float32)


@lru_cache(maxsize=512)
def text_img(s, weight, size, tracking, rgb=(255, 255, 255)):
    """Uppercase line set letter by letter so tracking can animate."""
    f = ImageFont.truetype(FONT[weight], max(4, int(size)))
    asc, desc = f.getmetrics()
    widths = [f.getlength(c) for c in s]
    total = sum(widths) + tracking * (len(s) - 1)
    pad = int(size * 0.2)
    im = Image.new("RGBA", (int(total) + 2 * pad, asc + desc + 2 * pad), rgb + (0,))
    d = ImageDraw.Draw(im)
    x = pad
    for c, w in zip(s, widths):
        d.text((x, pad), c, font=f, fill=rgb + (255,))
        x += w + tracking
    return im


def put_text(fr, s, cx, cy, size, weight=800, track_em=0.08, alpha=1.0, rgb=(255, 255, 255),
             glow=0.0, blur=0.0):
    im = text_img(s, weight, int(size), int(size * track_em), rgb)
    if blur > 0.3:
        im = im.filter(ImageFilter.GaussianBlur(blur))
    x, y = cx - im.width / 2, cy - im.height / 2
    fr.over(im, x, y, alpha)
    if glow > 0:
        g = Image.new("RGB", im.size)
        g.paste(Image.new("RGB", im.size, rgb), mask=im.getchannel("A").point(lambda v: int(v * glow * alpha)))
        fr.glow.paste(g, (int(x), int(y)), mask=im.getchannel("A").point(lambda v: int(v * glow * alpha)))
    return im.width


def fit_size(s, target_w, weight=800, track_em=0.08, start=200):
    """Font size that sets `s` at ~target_w pixels wide."""
    f = ImageFont.truetype(FONT[weight], start)
    w = sum(f.getlength(c) for c in s) + start * track_em * (len(s) - 1)
    return start * target_w / w


def kinetic(fr, s, t, a, b, cy=None, size=None, rgb=(255, 255, 255), weight=800, glow=0.0, maxw=0.78):
    """Standard on-screen statement: tracks in from wide, settles, drifts, dissolves."""
    if not (a - 0.1 < t < b + 0.1):
        return
    cy = H / 2 if cy is None else cy
    size = size or 64 * S()
    if PORTRAIT() and len(s) > 14 and " " in s:
        # phones get the statement on two lines at 1.5x, not a shrunken single line
        words = s.split(" ")
        cut = min(range(1, len(words)), key=lambda k: abs(len(" ".join(words[:k])) - len(s) / 2))
        lines = [" ".join(words[:cut]), " ".join(words[cut:])]
        sz = min([size * 1.5] + [fit_size(ln, W * maxw, weight, 0.13) for ln in lines])
        for j, ln in enumerate(lines):
            kinetic_line(fr, ln, t, a + 0.12 * j, b, cy + (j - 0.5) * sz * 1.25, sz, rgb, weight, glow, maxw)
        return
    kinetic_line(fr, s, t, a, b, cy, size, rgb, weight, glow, maxw)


def kinetic_line(fr, s, t, a, b, cy, size, rgb, weight, glow, maxw):
    p_in = out_cubic(seg(t, a, a + 0.9))
    p_out = seg(t, b - 0.6, b)
    track = lerp(0.42, 0.10, p_in) + 0.03 * seg(t, a, b)
    size = min(size, fit_size(s, W * maxw, weight, track))
    alpha = p_in * (1 - smooth(p_out))
    blur = (1 - p_in) * 10 * S() + smooth(p_out) * 8 * S()
    put_text(fr, s, W / 2, cy - (1 - p_in) * 6 * S() - p_out * 10 * S(), size, weight, track,
             alpha, rgb, glow, blur)


def line(fr, pts, rgb, width, alpha=1.0):
    if len(pts) < 2 or alpha <= 0.003:
        return
    c = tuple(int(v * 255 * alpha) for v in rgb)
    fr.gd.line([tuple(p) for p in pts], fill=c, width=max(1, int(round(width))), joint="curve")


def particles(fr, t, n=140, seed=3, alpha=0.5, rgb=(1.0, 0.86, 0.35), speed=1.0):
    rng = np.random.default_rng(seed)
    px, py = rng.random(n), rng.random(n)
    vz, ph, sz = rng.random(n), rng.random(n) * 6.28, rng.random(n)
    for i in range(n):
        x = (px[i] + 0.004 * speed * t * (0.3 + vz[i]) + 0.01 * math.sin(t * 0.4 + ph[i])) % 1
        y = (py[i] - 0.006 * speed * t * (0.2 + vz[i])) % 1
        tw = 0.5 + 0.5 * math.sin(t * (0.8 + vz[i]) + ph[i])
        r = (0.6 + 1.8 * sz[i] ** 3) * S() * 1.5
        a = alpha * tw * (0.25 + 0.75 * vz[i])
        c = tuple(int(255 * a * v) for v in rgb)
        fr.gd.ellipse((x * W - r, y * H - r, x * W + r, y * H + r), fill=c)


# --------------------------------------------------------------- 3D ground
class Cam:
    """Pinhole camera over the ground plane y=0, pitched down by `pitch` (rad)."""

    def __init__(self, x, h, z, pitch, yaw=0.0, fov=50):
        self.x, self.h, self.z, self.p, self.yaw = x, h, z, pitch, yaw
        self.F = (W if not PORTRAIT() else H * 0.75) / 2 / math.tan(math.radians(fov) / 2)

    def cam(self, X, Y, Z):
        dx, dy, dz = X - self.x, Y - self.h, Z - self.z
        cy, sy = math.cos(self.yaw), math.sin(self.yaw)
        dx, dz = dx * cy - dz * sy, dx * sy + dz * cy
        cp, sp = math.cos(self.p), math.sin(self.p)
        xc = dx
        yc = dy * cp + dz * sp
        zc = -dy * sp + dz * cp
        return xc, yc, zc

    def proj(self, X, Y, Z, near=0.3):
        xc, yc, zc = self.cam(X, Y, Z)
        if zc < near:
            return None
        return (W / 2 + self.F * xc / zc, H / 2 - self.F * yc / zc, zc)

    def polyline(self, pts3):
        out, cur = [], []
        for P in pts3:
            q = self.proj(*P)
            if q is None:
                if len(cur) > 1:
                    out.append(cur)
                cur = []
            else:
                cur.append(q)
        if len(cur) > 1:
            out.append(cur)
        return out


ROADS = [-90, -18, 32, 78, 128, 196]   # headings in degrees; -90 runs toward camera


def draw_crossroads(fr, cam, t, lit=None, lit_p=0.0, dim=1.0):
    """Roads radiating from the intersection at the origin. `lit` = index of the
    road that becomes the yellow path, grown to fraction lit_p of its length."""
    L, wd = 260.0, 3.2
    fog = 140.0
    for i, ang in enumerate(ROADS):
        a = math.radians(ang)
        ux, uz = math.cos(a), math.sin(a)
        nx, nz = -uz, ux
        steps = np.linspace(2.4, L, 140)
        for side in (-1, 1):
            pts = [(ux * s + nx * wd * side, 0, uz * s + nz * wd * side) for s in steps]
            for pl in cam.polyline(pts):
                for j in range(len(pl) - 1):
                    zf = math.exp(-pl[j][2] / fog)
                    line(fr, [pl[j][:2], pl[j + 1][:2]], (0.78, 0.78, 0.8), 1.6 * S(), 0.9 * zf * dim)
        # centre dashes
        for k in range(int(L / 6)):
            s0, s1 = 3 + k * 6, 3 + k * 6 + 2.6
            pl = cam.polyline([(ux * s0, 0, uz * s0), (ux * s1, 0, uz * s1)])
            for seg_ in pl:
                zf = math.exp(-seg_[0][2] / fog)
                line(fr, [p[:2] for p in seg_], (1, 1, 1), 1.8 * S(), 0.75 * zf * dim)
        if lit == i and lit_p > 0:
            send = 2.0 + (L - 2.0) * lit_p
            pts = [(ux * s, 0, uz * s) for s in np.linspace(0, send, 220)]
            for pl in cam.polyline(pts):
                for j in range(len(pl) - 1):
                    zf = 0.35 + 0.65 * math.exp(-pl[j][2] / (fog * 1.6))
                    wpx = max(1.5, cam.F * 0.55 / pl[j][2]) * 1.0
                    line(fr, [pl[j][:2], pl[j + 1][:2]], YELLOW, min(wpx, 14 * S()), zf)
                # bright head
                hx, hy, hz = pl[-1]
                r = max(3, cam.F * 0.9 / hz)
                fr.gd.ellipse((hx - r, hy - r, hx + r, hy + r), fill=(255, 240, 160))
    # the junction itself (a square of asphalt) gets no lines; a pool of light marks it
    pool = []
    for k in range(48):
        a = k / 48 * 6.283
        q = cam.proj(math.cos(a) * 3.2, 0, math.sin(a) * 3.2)
        if q:
            pool.append(q[:2])
    if len(pool) > 3 and cam.p > math.radians(40):
        m = Image.new("L", (W, H), 0)
        ImageDraw.Draw(m).polygon(pool, fill=255)
        m = m.filter(ImageFilter.GaussianBlur(6 * S()))
        fr.base += (np.asarray(m, np.float32) / 255 * 0.07 * dim)[..., None] * np.array([1, 0.85, 0.45], np.float32)


def draw_figure(fr, cam, X, Z, alpha=1.0, step=0.0):
    """A lone person: billboard silhouette when the camera is low, a lit dot from above."""
    foot = cam.proj(X, 0, Z)
    head = cam.proj(X, 1.75, Z)
    if not foot or not head:
        return
    fx, fy, fz = foot
    hgt = math.hypot(head[0] - fx, head[1] - fy)
    if hgt < 14 * S():
        r = max(2.0, cam.F * 0.32 / fz)
        sh = (int(fx - r * 1.4), int(fy - r * 0.6), int(fx + r * 1.4), int(fy + r * 1.6))
        d = ImageDraw.Draw(fr.glow)
        d.ellipse((fx - r * 2.2, fy - r * 2.2, fx + r * 2.2, fy + r * 2.2), fill=(70, 60, 20))
        d.ellipse((fx - r, fy - r, fx + r, fy + r), fill=(235, 235, 235))
        return
    s = hgt / 1.75
    im = Image.new("RGBA", (int(hgt * 0.7) + 8, int(hgt) + 8), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    cx, top = im.width / 2, 4
    P = lambda x, y: (cx + x * s, top + y * s)
    ink = (6, 6, 6, 255)
    sw = math.sin(step) * 0.09
    d.ellipse((*P(-0.1, 0.0), *P(0.1, 0.24)), fill=ink)
    d.polygon([P(-0.05, 0.22), P(0.05, 0.22), P(0.07, 0.29), P(0.22, 0.33), P(0.24, 0.42), P(0.21, 0.82),
               P(0.17, 0.86), P(0.16, 0.97), P(-0.16, 0.97), P(-0.17, 0.86), P(-0.21, 0.82), P(-0.24, 0.42),
               P(-0.22, 0.33), P(-0.07, 0.29)], fill=ink)
    for side, k in ((-1, sw), (1, -sw)):
        d.polygon([P(side * 0.16, 0.93), P(side * 0.015, 0.93), P(side * 0.03 + k, 1.74), P(side * 0.12 + k, 1.75)], fill=ink)
    fr.over(im, fx - im.width / 2, fy - im.height + 4, alpha)
    # the silhouette occludes the light behind it
    fr.glow.paste((0, 0, 0), (int(fx - im.width / 2), int(fy - im.height + 4)), mask=im.getchannel("A"))
    # rim light
    rim = im.getchannel("A").filter(ImageFilter.GaussianBlur(2))
    col = Image.new("RGB", im.size, (120, 100, 30))
    fr.glow.paste(col, (int(fx - im.width / 2), int(fy - im.height + 4)), mask=rim.point(lambda v: int(v * 0.35 * alpha)))


# ---------------------------------------------------------------- plates
PLATES = {
    "02A": "STUDENT · WEIGHING CAREER OPTIONS",
    "02B": "YOUNG ENTREPRENEUR · A BUSINESS DECISION",
    "02C": "PROFESSIONAL · REFLECTING ON WHAT'S NEXT",
    "02D": "SEEKER · SEARCHING FOR SPIRITUAL UNDERSTANDING",
    "02E": "EMERGING LEADER · PREPARING FOR RESPONSIBILITY",
    "04A": "WIDE · CONFERENCE STAGE, FULL HOUSE",
    "04B": "CLOSE-UP · ENTREPRENEUR SPEAKING",
    "04C": "AUDIENCE · LISTENING, REACTING",
    "04D": "MINISTER · FAITH-BASED GUIDANCE",
    "04E": "ONE-ON-ONE · MENTOR CONVERSATION",
    "04F": "SLOW MOTION · STANDING APPLAUSE",
    "05Z": "AUDIENCE · LIT BY WARM YELLOW STAGE LIGHT",
}


@lru_cache(maxsize=16)
def plate_src(pid):
    for ext in ("jpg", "png", "jpeg"):
        p = os.path.join(HERE, "plates", f"{pid}.{ext}")
        if os.path.exists(p):
            im = Image.open(p).convert("RGB")
            # cover-fit with 12% overscan for the push-in
            k = max(W / im.width, H / im.height) * 1.12
            return im.resize((int(im.width * k), int(im.height * k)), Image.LANCZOS)
    return None


def draw_plate(fr, pid, p, alpha=1.0):
    """p = 0..1 progress through the shot (drives the push-in)."""
    src = plate_src(pid)
    if src is not None:
        z = 1 + 0.08 * p
        cw, ch = W * src.width / (W * 1.12) / z, H * src.height / (H * 1.12) / z
        cw, ch = src.width / 1.12 / z * (W / (src.width / 1.12)), src.height / 1.12 / z * (H / (src.height / 1.12))
        box = ((src.width - W / z) / 2, (src.height - H / z) / 2 - 10 * p, (src.width + W / z) / 2, (src.height + H / z) / 2 - 10 * p)
        im = src.resize((W, H), Image.BILINEAR, box=box)
        arr = np.asarray(im, np.float32) / 255
        # grade into the brand: crushed blacks, warm highlights
        arr = np.clip((arr - 0.04) * 1.08, 0, 1) ** 1.08
        arr[..., 2] *= 0.92
        fr.base = fr.base * (1 - alpha) + arr * alpha
        return
    # slate: what this shot is, so the edit shows exactly what is still owed
    yy = np.linspace(0, 1, H, dtype=np.float32)[:, None, None]
    xx = np.linspace(0, 1, W, dtype=np.float32)[None, :, None]
    g = 0.06 + 0.05 * np.exp(-((xx - 0.5 - 0.1 * p) ** 2 / 0.08 + (yy - 0.45) ** 2 / 0.1))
    fr.base = fr.base * (1 - alpha) + np.broadcast_to(g * np.array([1, 0.92, 0.7], np.float32), fr.base.shape) * alpha
    u = S()
    m = 60 * u
    c = (0.35 * alpha, 0.35 * alpha, 0.35 * alpha)
    for (x, y, dx, dy) in [(m, m, 1, 1), (W - m, m, -1, 1), (m, H - m, 1, -1), (W - m, H - m, -1, -1)]:
        line(fr, [(x, y + dy * 40 * u), (x, y), (x + dx * 40 * u, y)], c, 2 * u)
    put_text(fr, f"PLATE {pid}", W / 2, H - m - 64 * u, 20 * u, 700, 0.3, 0.55 * alpha, (255, 212, 0))
    put_text(fr, PLATES[pid], W / 2, H - m - 34 * u, 16 * u, 500, 0.22, 0.45 * alpha)


def plate_sequence(fr, t, a, b, ids, words=(), word_rgb=None):
    """Plates cut on the yellow line: each change is a diagonal light wipe."""
    n = len(ids)
    d = (b - a) / n
    k = int(clamp((t - a) / d, 0, n - 1e-6))
    t0 = a + k * d
    draw_plate(fr, ids[k], seg(t, t0, t0 + d))
    if k + 1 < n:
        wp = seg(t, t0 + d - 0.35, t0 + d)
        if wp > 0:
            # incoming plate is revealed behind a travelling yellow line
            nxt = Frame()
            draw_plate(nxt, ids[k + 1], 0)
            edge = lerp(-0.3, 1.3, inout(wp))
            yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
            m = np.clip(((edge * (W + H) - (xx + yy * 0.6)) / (40 * S())), 0, 1)[..., None]
            fr.base = fr.base * (1 - m) + nxt.base * m
            # line itself
            x0 = edge * (W + H)
            line(fr, [(x0, 0), (x0 - H / 0.6 * 0.6 * 1.0 - 0, H)], YELLOW, 4 * S(), 1.0)


# ----------------------------------------------------------------- logo
@lru_cache(maxsize=1)
def logo_layers():
    one = Image.open(os.path.join(HERE, "logo-bold-one.png"))
    dr = Image.open(os.path.join(HERE, "logo-bold-dir.png"))
    # use the logo's own yellow, not the brief's hex: the mark must match its file
    one = Image.merge("RGBA", (*Image.new("RGB", one.size, LOGO_YELLOW).split(), one.getchannel("A")))
    box = (209, 320, 1046, 866)
    return one.crop(box), dr.crop(box)


@lru_cache(maxsize=8)
def logo_scaled(width):
    one, dr = logo_layers()
    k = width / one.width
    sz = (int(one.width * k), int(one.height * k))
    return one.resize(sz, Image.LANCZOS), dr.resize(sz, Image.LANCZOS)


# --------------------------------------------------------------- scenes
def scene01(fr, t):
    """00:00–12:00 THE QUESTION."""
    # 0–2.6: a single point of yellow light breathes in the dark
    if t < 3.4:
        a = smooth(seg(t, 0.25, 1.2)) * (1 - smooth(seg(t, 2.6, 3.3)))
        r = (3 + 2 * math.sin(t * 5)) * S()
        cx, cy = W / 2, H / 2
        fr.gd.ellipse((cx - r * 4, cy - r * 4, cx + r * 4, cy + r * 4), fill=tuple(int(v * 120 * a) for v in YELLOW))
        fr.gd.ellipse((cx - r, cy - r, cx + r, cy + r), fill=(int(255 * a), int(240 * a), int(170 * a)))
    if t > 2.4:
        # the light becomes the lone figure: hard match from the point to the person
        p = seg(t, 2.4, 12.6)
        h = lerp(150, 34, inout(p))
        cam = Cam(lerp(0, -2, p), h, lerp(-8, -30, p), math.radians(lerp(89, 62, inout(p))), yaw=math.radians(lerp(0, 6, p)))
        k = smooth(seg(t, 2.4, 4.2))
        sub = Frame()
        draw_crossroads(sub, cam, t, dim=0.85)
        draw_figure(sub, cam, 0, 0)
        fr.base = fr.base * (1 - k) + sub.base * k
        g = sub.glow.point(lambda v: int(v * k))
        fr.glow = Image.fromarray(np.maximum(np.asarray(fr.glow), np.asarray(g)))
        fr.gd = ImageDraw.Draw(fr.glow)
        particles(fr, t, 90, alpha=0.35)
    cy = H * (0.82 if not PORTRAIT() else 0.74)
    kinetic(fr, "LIFE IS FULL OF CHOICES.", t, 4.4, 7.9, cy, 58 * S())
    kinetic(fr, "BUT WHICH DIRECTION?", t, 8.3, 12.0, cy, 66 * S(), rgb=(255, 212, 0), glow=0.25)


def scene02(fr, t):
    """00:12–00:25 THE HUMAN SEARCH."""
    plate_sequence(fr, t, 12.0, 25.0, ["02A", "02B", "02C", "02D", "02E"])
    words = [("QUESTIONS.", 13.0, 15.6), ("DECISIONS.", 15.6, 18.2), ("UNCERTAINTY.", 18.2, 20.8), ("POSSIBILITIES.", 20.8, 24.6)]
    for wd, a, b in words:
        kinetic(fr, wd, t, a, b, H * 0.5, 120 * S(), rgb=(255, 212, 0) if wd.startswith("POSS") else (255, 255, 255),
                glow=0.15 if wd.startswith("POSS") else 0)
    # entry: the plate world cuts in out of black
    fr.base *= smooth(seg(t, 12.0, 12.5))


def beam_cam(t):
    p = seg(t, 27.4, 37.0)
    return Cam(0.0, lerp(2.2, 3.4, p), lerp(-6, 150, inout(p) * 0.6 + p * 0.4), math.radians(lerp(6, 9, p)), fov=55)


def scene03(fr, t):
    """00:25–00:37 THE LIGHT OF DIRECTION."""
    u = S()
    # 25.0–27.6: a horizontal beam slices the black
    if t < 28.4:
        p = out_cubic(seg(t, 25.0, 26.2))
        a = 1 - smooth(seg(t, 27.4, 28.3))
        x1 = lerp(-0.1 * W, 1.1 * W, p)
        cy = H / 2
        line(fr, [(-10, cy), (x1, cy)], YELLOW, 3 * u, a)
        line(fr, [(-10, cy), (x1, cy)], (1, 0.95, 0.7), 1 * u, a)
        fr.gd.ellipse((x1 - 9 * u, cy - 9 * u, x1 + 9 * u, cy + 9 * u), fill=(int(255 * a), int(250 * a), int(200 * a)))
    if t > 27.0:
        k = smooth(seg(t, 27.0, 28.2))
        cam = beam_cam(t)
        sub = Frame()
        # fragmented paths converge into one
        conv = smooth(seg(t, 28.0, 33.5))
        rng = np.random.default_rng(11)
        for i in range(9):
            sx = (i - 4) * 9.0 + rng.uniform(-2, 2)
            z0 = rng.uniform(5, 30)
            zj = 40 + i * 12
            pts = []
            for s in np.linspace(0, 1, 60):
                x = lerp(sx * (1 - conv * 0.0), 0, smooth(s) * conv) if conv > 0 else sx
                x = sx * (1 - smooth(s) * conv) if True else x
                pts.append((x + math.sin(s * 9 + i) * 2 * (1 - conv), 0, lerp(z0, zj + 60, s)))
            for pl in cam.polyline(pts):
                for j in range(len(pl) - 1):
                    zf = math.exp(-pl[j][2] / 160)
                    line(sub, [pl[j][:2], pl[j + 1][:2]], (1, 1, 1) if conv < 0.6 else YELLOW, 1.4 * u, 0.4 * zf * (0.4 + 0.6 * conv))
        # the main path
        grow = out_cubic(seg(t, 27.0, 29.5))
        pts = [(0, 0, z) for z in np.linspace(-4, lerp(0, 600, grow), 260)]
        for pl in cam.polyline(pts):
            for j in range(len(pl) - 1):
                zf = 0.25 + 0.75 * math.exp(-pl[j][2] / 260)
                w = min(max(1.6, cam.F * 0.32 / pl[j][2]), 26 * u)
                line(sub, [pl[j][:2], pl[j + 1][:2]], YELLOW, w, zf)
        # volumetric haze over the horizon
        hz = cam.proj(0, 0, 900)
        if hz:
            yy = np.arange(H, dtype=np.float32)[:, None]
            xx = np.arange(W, dtype=np.float32)[None, :]
            haze = np.exp(-((yy - hz[1]) / (90 * u)) ** 2) * np.exp(-((xx - hz[0]) / (W * 0.45)) ** 2)
            sub.base += haze[..., None] * YELLOW * 0.12
        fr.base = fr.base * (1 - k) + sub.base * k
        g = sub.glow.point(lambda v: int(v * k))
        fr.glow = Image.fromarray(np.maximum(np.asarray(fr.glow), np.asarray(g)))
        fr.gd = ImageDraw.Draw(fr.glow)
        # words stand beside the path; the camera flies past them
        for wd, z, side in [("CLARITY.", 45, -1), ("WISDOM.", 80, 1), ("VISION.", 115, -1), ("DIRECTION.", 175, 0)]:
            x = side * (5.5 if not PORTRAIT() else 3.2)
            q = cam.proj(x, 1.6 if side else 2.6, z)
            if not q:
                continue
            sc = cam.F / q[2]
            size = 1.5 * sc if side else 2.6 * sc
            if size < 6 or size > 900:
                continue
            fade = clamp((q[2] - 3) / 8) * clamp((70 - q[2]) / 25)
            rgb = (255, 212, 0) if wd == "DIRECTION." else (255, 255, 255)
            put_text(fr, wd, q[0], q[1], size, 800, 0.1, fade * k, rgb, glow=0.3 if side == 0 else 0)
        particles(fr, t, 110, seed=5, alpha=0.4, speed=3)


def scene04(fr, t):
    """00:37–00:53 THE VOICES THAT GUIDE."""
    plate_sequence(fr, t, 37.0, 53.0, ["04A", "04B", "04C", "04D", "04E", "04F"])
    fr.base *= smooth(seg(t, 37.0, 37.6))
    # lower-third roles: credibility without naming anyone we have not cleared
    roles = [("ENTREPRENEURS", 39.6, 42.2), ("INDUSTRY EXPERTS", 42.4, 45.0), ("PEOPLE OF FAITH", 45.1, 47.7),
             ("MENTORS", 47.8, 50.3)]
    u = S()
    x0 = W * (0.08 if not PORTRAIT() else 0.1)
    yb = H * (0.8 if not PORTRAIT() else 0.72)
    for r, a, b in roles:
        w = window(t, a, b, 0.5, 0.4)
        if w <= 0:
            continue
        p = out_cubic(seg(t, a, a + 0.7))
        ln = 160 * u * p
        line(fr, [(x0, yb), (x0 + ln, yb)], YELLOW, 3 * u, w)
        im = text_img(r, 700, int(30 * u), int(30 * u * 0.22))
        fr.over(im, x0 - im.height * 0.2 + (1 - p) * -20 * u, yb + 10 * u, w)


WORDS05 = ["CONFERENCES.", "MENTORSHIP.", "LEADERSHIP.", "FAITH.", "BUSINESS.", "PURPOSE.", "GROWTH."]


def scene05(fr, t):
    """00:53–01:06 THE EXPERIENCE: words travel through black space toward camera."""
    u = S()
    a0, step = 53.3, 1.36
    # directional streaks stream past: the line motif at speed
    rng = np.random.default_rng(21)
    n = 70
    ang = rng.random(n) * 6.283
    off = rng.random(n)
    spd = 0.6 + rng.random(n)
    cx, cy = W / 2, H / 2
    vis = window(t, 53.0, 63.6, 0.4, 0.6)
    for i in range(n):
        z = (off[i] - (t - 53) * 0.35 * spd[i]) % 1.0
        r0 = 0.08 / max(z, 0.02)
        r1 = 0.08 / max(z + 0.06 * spd[i], 0.02)
        R = max(W, H) * 0.5
        p0 = (cx + math.cos(ang[i]) * r0 * R, cy + math.sin(ang[i]) * r0 * R)
        p1 = (cx + math.cos(ang[i]) * r1 * R, cy + math.sin(ang[i]) * r1 * R)
        col = YELLOW if i % 4 == 0 else (0.8, 0.8, 0.8)
        line(fr, [p1, p0], col, 1.4 * u, 0.5 * vis * clamp(1.4 - z * 1.4))
    for i, wd in enumerate(WORDS05):
        a = a0 + i * step
        if not (a - 0.4 < t < a + step + 0.6):
            continue
        # approach (fast, blurred) -> read (slow push) -> fly past (huge, fading)
        p_in = seg(t, a - 0.02, a + 0.3)
        p_out = seg(t, a + step - 0.32, a + step - 0.02)
        scale = lerp(0.25, 1.0, out_cubic(p_in)) * (1 + 0.06 * seg(t, a, a + step)) * (1 + 4 * in_cubic(p_out))
        alpha = smooth(p_in) * (1 - smooth(p_out))
        yellow = i % 2 == 1 or wd == "PURPOSE."
        base = fit_size(wd, W * (0.62 if not PORTRAIT() else 0.84), 800, 0.06)
        base = min(base, 190 * u)
        blur = (1 - p_in) * 6 * u + p_out * 14 * u
        put_text(fr, wd, cx, cy, base * scale, 800, 0.06, alpha, (255, 212, 0) if yellow else (255, 255, 255),
                 glow=0.25 if yellow else 0.05, blur=blur)
    # 63.0–66.0: the audience in warm stage light
    if t > 63.0:
        k = smooth(seg(t, 63.0, 63.8))
        sub = Frame()
        draw_plate(sub, "05Z", seg(t, 63.0, 66.0))
        # stage beams from above
        for j in range(5):
            bx = W * (0.15 + 0.175 * j) + math.sin(t * 0.7 + j) * 30 * u
            sw_ = W * 0.022
            poly = [(bx - sw_ * 0.2, -10), (bx + sw_ * 0.2, -10), (bx + sw_ * 2.2, H * 0.9), (bx - sw_ * 2.2, H * 0.9)]
            c = tuple(int(v * 255 * 0.07) for v in (1.0, 0.8, 0.3))
            sub.gd.polygon(poly, fill=c)
        fr.base = fr.base * (1 - k) + sub.base * k
        g = sub.glow.filter(ImageFilter.GaussianBlur(18 * u)).point(lambda v: int(v * k))
        fr.glow = Image.fromarray(np.maximum(np.asarray(fr.glow), np.asarray(g)))
        fr.gd = ImageDraw.Draw(fr.glow)


def scene06(fr, t):
    """01:06–01:17 THE TRANSFORMATION: same crossroads, one road now lit."""
    p = seg(t, 66.0, 77.0)
    k = smooth(seg(t, 66.0, 66.8))
    walk = smooth(seg(t, 67.2, 75.5))
    lit = 2                     # road at 32°: forward and to the right — an upward, forward heading
    a = math.radians(ROADS[lit])
    fx, fz = math.cos(a) * 9 * walk, math.sin(a) * 9 * walk
    # camera: low behind the figure, looking down the lit road, then rising to aerial
    rise = inout(seg(t, 69.5, 77.0))
    back = 15 + 30 * rise
    yaw = -(a - math.pi / 2)
    cam = Cam(fx - math.cos(a) * back, lerp(2.4, 110, rise ** 1.4), fz - math.sin(a) * back,
              math.radians(lerp(5, 70, rise)), yaw=yaw, fov=lerp(48, 55, rise))
    sub = Frame()
    draw_crossroads(sub, cam, t, lit=lit, lit_p=out_cubic(seg(t, 66.4, 71.0)), dim=0.9)
    # dawn haze on the horizon the road points to
    hz = cam.proj(math.cos(a) * 2000, 0, math.sin(a) * 2000)
    if hz:
        yy = np.arange(H, dtype=np.float32)[:, None]
        xx = np.arange(W, dtype=np.float32)[None, :]
        haze = np.exp(-((yy - hz[1]) / (140 * S())) ** 2) * np.exp(-((xx - hz[0]) / (W * 0.6)) ** 2)
        sub.base += haze[..., None] * np.array([1.0, 0.78, 0.25], np.float32) * 0.35
    draw_figure(sub, cam, fx, fz, step=(t - 67) * 5 * (walk < 0.999) * (walk > 0.001))
    fr.base = fr.base * (1 - k) + sub.base * k
    g = sub.glow.point(lambda v: int(v * k))
    fr.glow = Image.fromarray(np.maximum(np.asarray(fr.glow), np.asarray(g)))
    fr.gd = ImageDraw.Draw(fr.glow)
    particles(fr, t, 120, seed=9, alpha=0.45)
    cy = H * (0.2 if not PORTRAIT() else 0.22)
    kinetic(fr, "YOUR FUTURE NEEDS DIRECTION.", t, 68.2, 72.0, cy, 58 * S())
    kinetic(fr, "YOUR JOURNEY STARTS HERE.", t, 72.4, 76.6, cy, 64 * S(), rgb=(255, 212, 0), glow=0.25)
    fr.base *= 1 - smooth(seg(t, 76.4, 77.0))


def scene07(fr, t):
    """01:17–01:28 THE GRAND REVEAL."""
    u = S()
    cy = H / 2
    lw = W * (0.6 if not PORTRAIT() else 0.84)
    one, dr = logo_scaled(int(lw))
    lx, ly = (W - one.width) / 2, cy - one.height * 0.56
    # the yellow line crosses, accelerating, and stops dead where the logo will stand
    impact = 80.4
    if t < impact + 0.6:
        p = seg(t, 77.2, impact) ** 2.2
        head = lerp(-0.02 * W, W / 2, p)
        tail = head - lerp(0.05, 0.9, p) * W * (1 - seg(t, impact, impact + 0.5))
        a = 1 - smooth(seg(t, impact + 0.1, impact + 0.6))
        y = cy + one.height * 0.27
        line(fr, [(tail, y), (head, y)], YELLOW, 4.5 * u, a)
        line(fr, [(tail, y), (head, y)], (1, 0.96, 0.75), 1.5 * u, a)
        fr.gd.ellipse((head - 7 * u, y - 7 * u, head + 7 * u, y + 7 * u), fill=(int(255 * a), int(248 * a), int(200 * a)))
    # flash at impact
    fl = math.exp(-max(0, t - impact) * 6) * (t >= impact)
    if fl > 0.01:
        yy = np.arange(H, dtype=np.float32)[:, None]
        xx = np.arange(W, dtype=np.float32)[None, :]
        y = cy + one.height * 0.27
        f = np.exp(-((xx - W / 2) / (W * 0.25)) ** 2 - ((yy - y) / (30 * u)) ** 2) * fl
        fr.base += f[..., None] * np.array([1, 0.92, 0.6], np.float32) * 1.2
    if t >= impact:
        # light rays behind the mark
        rays = window(t, impact, 88, 0.6, 1.5)
        for j in range(14):
            ang = j / 14 * 6.283 + t * 0.05
            r = max(W, H)
            c = tuple(int(v * 255 * 0.05 * rays) for v in (1, 0.85, 0.3))
            fr.gd.polygon([(W / 2, cy), (W / 2 + math.cos(ang - 0.04) * r, cy + math.sin(ang - 0.04) * r),
                           (W / 2 + math.cos(ang + 0.04) * r, cy + math.sin(ang + 0.04) * r)], fill=c)
        # ONE: revealed left->right behind a travelling light edge, settling from 104%
        p = out_cubic(seg(t, impact, impact + 1.4))
        sc = lerp(1.05, 1.0, out_cubic(seg(t, impact, impact + 3.5)))
        o = one if abs(sc - 1) < 0.002 else one.resize((int(one.width * sc), int(one.height * sc)), Image.BILINEAR)
        ox, oy = W / 2 - o.width / 2, ly + one.height / 2 - o.height / 2
        mask = Image.new("L", o.size, 0)
        edge = int(lerp(-0.1, 1.15, p) * o.width)
        if edge > 0:
            ImageDraw.Draw(mask).rectangle((0, 0, edge, o.height), fill=255)
        mask = mask.filter(ImageFilter.GaussianBlur(30 * u))
        oo = o.copy()
        oo.putalpha(Image.fromarray((np.asarray(o.getchannel("A"), np.float32) * np.asarray(mask, np.float32) / 255).astype(np.uint8)))
        fade_all = 1 - smooth(seg(t, 86.6, 88.0))
        fr.over(oo, ox, oy, fade_all)
        gl = Image.new("RGB", o.size, LOGO_YELLOW)
        fr.glow.paste(gl, (int(ox), int(oy)), mask=oo.getchannel("A").point(lambda v: int(v * 0.07 * fade_all)))
        # sweep highlight
        if 0 < p < 1:
            ex = ox + edge
            line(fr, [(ex, oy), (ex, oy + o.height * 0.75)], (1, 0.95, 0.7), 3 * u, 0.6 * (1 - p))
        # DIRECTION opens from the centre
        pd = out_cubic(seg(t, impact + 0.9, impact + 2.2))
        if pd > 0:
            d = dr if abs(sc - 1) < 0.002 else dr.resize(o.size, Image.BILINEAR)
            m2 = Image.new("L", d.size, 0)
            half = pd * d.width / 2
            ImageDraw.Draw(m2).rectangle((d.width / 2 - half, 0, d.width / 2 + half, d.height), fill=255)
            dd = d.copy()
            dd.putalpha(Image.fromarray((np.asarray(d.getchannel("A"), np.float32) * np.asarray(m2, np.float32) / 255).astype(np.uint8)))
            fr.over(dd, ox, oy, fade_all * pd)
        # tagline
        tg_a = window(t, impact + 2.0, 88.0, 1.0, 1.4)
        ptg = out_cubic(seg(t, impact + 2.0, impact + 3.6))
        size = 36 * u if not PORTRAIT() else 40 * u
        put_text(fr, "WHERE DESTINIES ARE MADE", W / 2, ly + one.height + 70 * u, size, 500,
                 lerp(0.7, 0.34, ptg), tg_a, (255, 212, 0), glow=0.2, blur=(1 - ptg) * 4 * u)
        particles(fr, t, 120, seed=13, alpha=0.5 * fade_all)


SCENES = [(0, 12, scene01), (12, 25, scene02), (25, 37, scene03), (37, 53, scene04), (53, 66, scene05),
          (66, 77, scene06), (77, 88.1, scene07)]


def render(t):
    fr = Frame()
    for a, b, fn in SCENES:
        if a - 0.01 <= t < b:
            fn(fr, t)
    fade = smooth(seg(t, 0, 0.3)) if t < 0.3 else 1.0
    return fr.finish(t, fade=fade)


def _job(i):
    return render(i / FPS).tobytes()


def main():
    global W, H
    fmt = sys.argv[1] if len(sys.argv) > 1 else "landscape"
    W, H = FORMATS[fmt]
    out = os.path.join(HERE, "out")
    os.makedirs(out, exist_ok=True)
    if "--still" in sys.argv:
        for ts in sys.argv[sys.argv.index("--still") + 1:]:
            Image.fromarray(render(float(ts))).save(os.path.join(out, f"still-{fmt}-{float(ts):05.1f}.png"))
        return
    a0 = float(os.environ.get("T0", 0))
    a1 = float(os.environ.get("T1", DUR))
    frames = range(int(a0 * FPS), int(a1 * FPS))
    dst = os.path.join(out, os.environ.get("OUT", f"one-direction-{fmt}-video.mp4"))
    ff = subprocess.Popen(["ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24",
                           "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-", "-c:v", "libx264", "-preset", "slow",
                           "-crf", os.environ.get("CRF", "16"), "-pix_fmt", "yuv420p", "-tune", "film", dst],
                          stdin=subprocess.PIPE)
    with Pool(int(os.environ.get("JOBS", os.cpu_count()))) as pool:
        for n, buf in enumerate(pool.imap(_job, frames, chunksize=4)):
            ff.stdin.write(buf)
            if n % 240 == 0:
                print(f"{fmt}: {n / FPS:5.1f}s", flush=True)
    ff.stdin.close()
    ff.wait()
    print(dst)


if __name__ == "__main__":
    main()
