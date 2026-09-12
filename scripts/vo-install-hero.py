#!/usr/bin/env python3
"""Install a Higgsfield-generated clip as the VO Nail Artist background.

Why this exists: the clips are generated on Higgsfield, but the session that
generated them could not fetch the result — the output CDN
(d8j0ntlcm91z4.cloudfront.net) is refused by the sandbox's egress policy, and
routing around an organisation policy is not an option. So the download runs
where the files are actually reachable: a normal machine.

It also does the finishing the site needs and the generator does not: an
encode small enough to sit in front of a first-time visitor, a poster pulled
from frame one, and the `-movflags +faststart` that lets playback begin before
the whole file has arrived.

Usage — a URL, a local file, or one of each:

    python3 scripts/vo-install-hero.py \\
        --landscape "https://…/hf_…_landscape.mp4" \\
        --portrait  "https://…/hf_…_portrait.mp4"

    python3 scripts/vo-install-hero.py --landscape ~/Downloads/hero.mp4

Either flag may be omitted; whatever is passed is replaced and the rest is
left alone. Nothing is overwritten until both the download and the encode have
succeeded, so a failed run leaves the committed clip playing.

Writes into assets/vo/:
    hero.mp4  + hero.webm  + hero-poster.jpg                    (--landscape)
    hero-portrait.mp4 + .webm + hero-poster-portrait.jpg        (--portrait)

Requires an ffmpeg binary (`pip install imageio-ffmpeg` supplies a static one).
"""

import argparse
import os
import shutil
import subprocess
import sys
import tempfile
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "assets", "vo")

# Target widths. The clips arrive at 2K; a background does not need it, and a
# visitor on a phone plan should not pay for it.
TARGETS = {
    "landscape": {"width": 1920, "video": "hero.mp4", "webm": "hero.webm",
                  "poster": "hero-poster.jpg"},
    "portrait": {"width": 1080, "video": "hero-portrait.mp4", "webm": "hero-portrait.webm",
                 "poster": "hero-poster-portrait.jpg"},
}


def find_ffmpeg():
    try:
        import imageio_ffmpeg

        return imageio_ffmpeg.get_ffmpeg_exe()
    except ImportError:
        pass
    exe = shutil.which("ffmpeg")
    if not exe:
        sys.exit("ffmpeg not found — `pip install imageio-ffmpeg` or install ffmpeg.")
    return exe


def fetch(src, dest):
    """Accept a URL or a path on disk, and leave the bytes at `dest`."""
    if src.startswith(("http://", "https://")):
        print(f"  downloading {src[:72]}…")
        try:
            with urllib.request.urlopen(src, timeout=120) as r, open(dest, "wb") as f:
                shutil.copyfileobj(r, f)
        except Exception as e:
            sys.exit(f"  download failed: {e}")
    else:
        path = os.path.expanduser(src)
        if not os.path.isfile(path):
            sys.exit(f"  no such file: {path}")
        shutil.copyfile(path, dest)

    size = os.path.getsize(dest)
    if size < 10_000:
        sys.exit(f"  got {size} bytes — that is not a video. Check the link.")
    print(f"  {size / 1e6:.2f} MB in hand")


def install(kind, src, ffmpeg):
    spec = TARGETS[kind]
    print(f"\n{kind}:")
    tmp = tempfile.mkdtemp(prefix=f"vo-{kind}-")
    try:
        raw = os.path.join(tmp, "raw.mp4")
        fetch(src, raw)

        # Scale to an even height whatever the source ratio: yuv420p cannot
        # encode odd dimensions, and -2 rounds for us.
        out = os.path.join(tmp, spec["video"])
        print("  encoding…")
        subprocess.run(
            [ffmpeg, "-y", "-loglevel", "error", "-i", raw,
             "-vf", f"scale={spec['width']}:-2:flags=lanczos",
             "-c:v", "libx264", "-profile:v", "high", "-pix_fmt", "yuv420p",
             "-preset", "slow", "-crf", "26", "-g", "48",
             "-an",                       # a background clip is always muted
             "-movflags", "+faststart",
             out],
            check=True,
        )

        # VP9 too: H.264 is missing from Chromium builds without proprietary
        # codecs and from some Linux Firefox builds, which would leave those
        # visitors staring at the poster. It also encodes smaller.
        webm = os.path.join(tmp, spec["webm"])
        print("  encoding webm…")
        subprocess.run(
            [ffmpeg, "-y", "-loglevel", "error", "-i", raw,
             "-vf", f"scale={spec['width']}:-2:flags=lanczos",
             "-c:v", "libvpx-vp9", "-crf", "40", "-b:v", "0",
             "-row-mt", "1", "-deadline", "good", "-cpu-used", "4",
             "-g", "48", "-an",
             webm],
            check=True,
        )

        poster = os.path.join(tmp, spec["poster"])
        subprocess.run(
            [ffmpeg, "-y", "-loglevel", "error", "-i", out, "-frames:v", "1",
             "-q:v", "3", poster],
            check=True,
        )

        os.makedirs(OUT, exist_ok=True)
        for name in (spec["video"], spec["webm"], spec["poster"]):
            shutil.move(os.path.join(tmp, name), os.path.join(OUT, name))

        mb = os.path.getsize(os.path.join(OUT, spec["video"])) / 1e6
        print(f"  wrote assets/vo/{spec['video']} ({mb:.2f} MB) and {spec['poster']}")
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--landscape", metavar="URL_OR_PATH", help="16:9 clip for desktop")
    ap.add_argument("--portrait", metavar="URL_OR_PATH", help="9:16 clip for phones")
    args = ap.parse_args()

    if not args.landscape and not args.portrait:
        ap.error("pass --landscape and/or --portrait")

    ffmpeg = find_ffmpeg()
    if args.landscape:
        install("landscape", args.landscape, ffmpeg)
    if args.portrait:
        install("portrait", args.portrait, ffmpeg)

    print("\nDone. Check it, then commit:")
    print("  python3 -m http.server 8000   # open http://localhost:8000/vo.html")
    print("  git add assets/vo && git commit -m 'Use the Higgsfield hero clip'")


if __name__ == "__main__":
    main()
