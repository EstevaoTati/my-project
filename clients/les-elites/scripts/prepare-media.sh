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

# Higgsfield job → scene. Re-generate a scene? Replace its URL here.
URLS=(
  "https://d8j0ntlcm91z4.cloudfront.net/user_3G9osobYr0aAENArzSDrqEFJFgW/hf_20261031_164013_d8fda6dd-27a1-45a3-a2d0-50a0dbe5dafe.mp4"   # 01 arrival
  "https://d8j0ntlcm91z4.cloudfront.net/user_3G9osobYr0aAENArzSDrqEFJFgW/hf_20261031_164014_2aee7991-6d50-4eb2-9719-dcbf6b87360f.mp4"   # 02 hall
  "https://d8j0ntlcm91z4.cloudfront.net/user_3G9osobYr0aAENArzSDrqEFJFgW/hf_20261031_164013_84666f8e-e0ab-4eb0-80d8-80b6d1ca924f.mp4"   # 03 library
  "https://d8j0ntlcm91z4.cloudfront.net/user_3G9osobYr0aAENArzSDrqEFJFgW/hf_20261031_164013_f189fc6f-a8ba-4f85-80a9-d94e0558f894.mp4"   # 04 manuscript → book
  "https://d8j0ntlcm91z4.cloudfront.net/user_3G9osobYr0aAENArzSDrqEFJFgW/hf_20261031_164013_05c6526f-f677-465e-9f1d-83572ea3e3eb.mp4"   # 05 observatory
)

for i in 1 2 3 4 5; do
  n=$(printf '%02d' "$i")
  src="raw/scene-$n.mp4"
  if [[ "${1:-}" != "--local" && ! -s "$src" ]]; then
    echo "↓ scene $n"; curl -fsSL -o "$src" "${URLS[$((i-1))]}"
  fi
  [[ -s "$src" ]] || { echo "missing $src — skipped (the site falls back to the poster/painted scene)"; continue; }
  enc() { ffmpeg -loglevel error -y -i "$src" -an -vf "scale=$1:-2:flags=lanczos,format=yuv420p" \
          -c:v libx264 -preset slow -crf "$2" -g 6 -keyint_min 6 -sc_threshold 0 -bf 0 \
          -profile:v high -movflags +faststart "$3"; }
  enc 1280 24 "media/scene-$n.mp4"
  enc 960  27 "media/scene-$n-m.mp4"
  ffmpeg -loglevel error -y -i "media/scene-$n.mp4" -frames:v 1 -q:v 3 "media/scene-$n.jpg"
  printf '✓ scene %s  %s  %s\n' "$n" "$(du -h "media/scene-$n.mp4" | cut -f1)" "$(du -h "media/scene-$n-m.mp4" | cut -f1)"
done
echo "Done. Commit media/ (raw/ is ignored)."
