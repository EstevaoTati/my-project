#!/usr/bin/env bash
# Pull the two generated background clips into assets/.
#
# Run this from a machine with normal internet access — the session that
# generated them could reach Higgsfield's upload bucket but not its output CDN,
# so it could not do this itself.
#
#   bash scripts/fetch-hero-videos.sh
#
# Then commit assets/hero-platform.mp4 and assets/hero-bi.mp4. Nothing else
# needs changing: both pages already carry the <video> elements.
set -euo pipefail

cd "$(dirname "$0")/.."
mkdir -p assets

BASE="https://d8j0ntlcm91z4.cloudfront.net/user_3G9osobYr0aAENArzSDrqEFJFgW"
PLATFORM="hf_20260824_010122_c520a369-f76c-434d-b275-02a07e2d6607.mp4"
BI="hf_20260824_010047_7ea6e8c5-3f8c-4a73-ba09-4a7561069a3d.mp4"

get() {
  local url="$1" out="$2"
  echo "→ $out"
  # --fail so a 403/404 stops the script instead of writing an HTML error page
  # into a file the browser would then try to play.
  curl -fsSL "$url" -o "$out"
  # A CloudFront error body is small; a real clip is not.
  local size
  size=$(wc -c < "$out")
  if [ "$size" -lt 100000 ]; then
    echo "  ✗ only ${size} bytes — that is not a video. Removing." >&2
    rm -f "$out"
    return 1
  fi
  echo "  ✓ $(( size / 1024 )) KB"
}

get "$BASE/$PLATFORM" assets/hero-platform.mp4
get "$BASE/$BI"       assets/hero-bi.mp4

echo
echo "Done. Check them, then:"
echo "  git add assets/hero-platform.mp4 assets/hero-bi.mp4"
echo "  git commit -m 'Add the generated background clips'"
echo "  git push"
echo
echo "If the links have expired, open the Higgsfield library and save the two"
echo "clips manually under exactly those filenames — the job ids are in"
echo "docs/hero-video.md."
