#!/usr/bin/env bash
# Downloads the Higgsfield scene clips and encodes them as seamless loops.
#
#   bash scripts/prepare-media.sh            # download + encode
#   bash scripts/prepare-media.sh --local    # encode raw/scene-0N.mp4 you already have
#
# Why re-encode: the scenes play continuously on a loop (founder: "animated
# without stopping"). A forward camera move that loops would snap back to its
# first frame, so each clip becomes a boomerang — forward, then reversed —
# and the motion breathes back and forth with no visible cut. 14 s per scene,
# keyframe every 2 s, ~3-6 MB. Audio is stripped (never autoplay sound).
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
  # Boomerang: forward + reversed (minus the duplicated turn frames), so the
  # looping camera move eases back and forth instead of snapping to frame 0.
  ffmpeg -loglevel error -y -i "$src" -an -filter_complex \
    "[0:v]split[f][b];[b]reverse,trim=start_frame=1,setpts=PTS-STARTPTS[r];[f][r]concat=n=2:v=1,trim=end_frame=$(( $(ffprobe -v error -count_frames -select_streams v -show_entries stream=nb_read_frames -of csv=p=0 "$src") * 2 - 2 )),setpts=PTS-STARTPTS[v]" \
    -map "[v]" -c:v libx264 -preset slow -crf 16 "raw/loop-$n.mp4"
  enc "raw/loop-$n.mp4" 1280 24 48 "media/scene-$n.mp4"
  enc "raw/loop-$n.mp4" 960  27 48 "media/scene-$n-m.mp4"
  ffmpeg -loglevel error -y -i "media/scene-$n.mp4" -frames:v 1 -q:v 3 "media/scene-$n.jpg"
  printf '✓ scene %s  %s  %s\n' "$n" "$(du -h "media/scene-$n.mp4" | cut -f1)" "$(du -h "media/scene-$n-m.mp4" | cut -f1)"
done

# Catalogue header: plays as a loop, never scrubbed → normal GOP, smaller file.
fetch "$LOOP" raw/catalogue-loop.mp4 || true
if [[ -s raw/catalogue-loop.mp4 ]]; then
  ffmpeg -loglevel error -y -i raw/catalogue-loop.mp4 -an -filter_complex \
    "[0:v]split[f][b];[b]reverse,trim=start_frame=1,setpts=PTS-STARTPTS[r];[f][r]concat=n=2:v=1[v]" \
    -map "[v]" -c:v libx264 -preset slow -crf 16 raw/catalogue-boomerang.mp4
  enc raw/catalogue-boomerang.mp4 720 27 48 media/catalogue-loop.mp4
  ffmpeg -loglevel error -y -i media/catalogue-loop.mp4 -frames:v 1 -q:v 3 media/catalogue-loop.jpg
  echo "✓ catalogue loop $(du -h media/catalogue-loop.mp4 | cut -f1)"
fi
echo "Done. Commit media/ (raw/ is ignored)."
