#!/usr/bin/env bash
# Extrait ~120 frames WebP du clip hero-orbit pour le scrub canvas du portfolio.
# Usage: ./extract-hero-frames.sh chemin/vers/hero-orbit.mp4
set -euo pipefail

SRC="${1:?Usage: $0 <hero-orbit.mp4>}"
OUT="$(dirname "$0")/../assets/hero"
mkdir -p "$OUT"

DUR=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$SRC")
FPS=$(python3 -c "print(120/float('$DUR'))")

echo "Durée: ${DUR}s → extraction à ${FPS} fps (≈120 frames)"
ffmpeg -y -i "$SRC" -vf "fps=${FPS},scale=1280:-2" -c:v libwebp -quality 62 "$OUT/frame_%04d.webp"

COUNT=$(ls "$OUT"/frame_*.webp | wc -l)
echo "$COUNT frames écrites dans $OUT"
echo "Si ≠ 120, ajuster FRAME_COUNT dans portfolio/index.html"

# Frame OG (1200x630) depuis le milieu du clip
ffmpeg -y -ss "$(python3 -c "print(float('$DUR')/2)")" -i "$SRC" -frames:v 1 -vf "scale=1200:630:force_original_aspect_ratio=increase,crop=1200:630" "$OUT/og-frame.jpg"
echo "og-frame.jpg régénérée depuis le clip"
