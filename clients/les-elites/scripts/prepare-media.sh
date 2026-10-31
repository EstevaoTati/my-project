#!/usr/bin/env bash
# Downloads the Higgsfield scene clips and encodes them for scroll-scrubbing.
#
#   bash scripts/prepare-media.sh            # download + encode
#   bash scripts/prepare-media.sh --local    # encode raw/scene-0N.mp4 you already have
#
# Why re-encode: a browser can only seek to a keyframe and decode forward.
# Higgsfield exports have a keyframe every ~2 s, so scrubbing stutters. Here
# every 6th frame is a keyframe (no B-frames): smooth seeks for a file size
# that stays near 3-5 MB per 7 s clip. Audio is stripped (never autoplay sound).
#
# Outputs, all read by index.html:
#   media/scene-0N.mp4    1280w desktop
#   media/scene-0N-m.mp4  960w small screens
#   media/scene-0N.jpg    poster = frame 0 (what shows before/without video)
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p raw media

# Higgsfield job → scene (warm classic direction, 2026-10-31).
# Re-generate a scene? Replace its URL here.
H=https://d8j0ntlcm91z4.cloudfront.net/user_3G9osobYr0aAENArzSDrqEFJFgW
URLS=(
  "$H/hf_20261031_170319_24cd0c43-fd9b-4cfa-871a-05552e890a4d.mp4"   # 01 façade → doors
  "$H/hf_20261031_170454_fa0e5267-a2d5-4c5a-8634-1005ba8995af.mp4"  # 02 grand hall
  "$H/hf_20261031_170454_0c7c155b-7762-4fe9-b4b6-a060880a8fbc.mp4"  # 03 reading room, ladder
  "$H/hf_20261031_170750_792b09d4-ce5a-4bc2-bb33-9481483b900f.mp4"  # 04 manuscript → book
  "$H/hf_20261031_170319_4d77447b-47c5-42d6-acd4-5c3442042a75.mp4"   # 05 arched windows, sunrise
)
LOOP="$H/hf_20261031_170750_754c3a5b-d49a-434b-8a21-d1354f9032dc.mp4" # catalogue header (9:16)

enc() { # src width crf gop out
  ffmpeg -loglevel error -y -i "$1" -an -vf "scale=$2:-2:flags=lanczos,format=yuv420p" \
    -c:v libx264 -preset slow -crf "$3" -g "$4" -keyint_min "$4" -sc_threshold 0 -bf 0 \
    -profile:v high -movflags +faststart "$5"; }
fetch() { [[ "${LOCAL:-}" == 1 || -s "$2" ]] || { echo "↓ $2"; curl -fsSL -o "$2" "$1"; }; }
[[ "${1:-}" == "--local" ]] && LOCAL=1

for i in 1 2 3 4 5; do
  n=$(printf '%02d' "$i"); src="raw/scene-$n.mp4"
  fetch "${URLS[$((i-1))]}" "$src" || true
  [[ -s "$src" ]] || { echo "missing $src — skipped (the site falls back to the poster/painted scene)"; continue; }
  enc "$src" 1280 24 6 "media/scene-$n.mp4"     # keyframe every 6 frames: smooth scroll-scrub
  enc "$src" 960  27 6 "media/scene-$n-m.mp4"
  ffmpeg -loglevel error -y -i "media/scene-$n.mp4" -frames:v 1 -q:v 3 "media/scene-$n.jpg"
  printf '✓ scene %s  %s  %s\n' "$n" "$(du -h "media/scene-$n.mp4" | cut -f1)" "$(du -h "media/scene-$n-m.mp4" | cut -f1)"
done

# Catalogue header: plays as a loop, never scrubbed → normal GOP, smaller file.
fetch "$LOOP" raw/catalogue-loop.mp4 || true
if [[ -s raw/catalogue-loop.mp4 ]]; then
  enc raw/catalogue-loop.mp4 720 27 48 media/catalogue-loop.mp4
  ffmpeg -loglevel error -y -i media/catalogue-loop.mp4 -frames:v 1 -q:v 3 media/catalogue-loop.jpg
  echo "✓ catalogue loop $(du -h media/catalogue-loop.mp4 | cut -f1)"
fi
echo "Done. Commit media/ (raw/ is ignored)."
