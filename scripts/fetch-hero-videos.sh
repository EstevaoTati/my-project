#!/usr/bin/env bash
# Pull the two generated background clips into assets/.
#
# These are the 10-second versions, cut to the founder's beat-by-beat brief.
# An earlier 5-second pair exists and is superseded.
#
# Run this from a machine with normal internet access. The session that
# generated the clips could reach Higgsfield's upload bucket but not its output
# CDN — that host is refused by an egress policy, which is to be reported, not
# routed around — so it could not do this step itself.
#
#   bash scripts/fetch-hero-videos.sh
#
# Then commit the two files. Nothing else needs changing: both pages already
# carry the <video> elements pointing at these exact paths.
set -euo pipefail

cd "$(dirname "$0")/.."
mkdir -p assets

BASE="https://d8j0ntlcm91z4.cloudfront.net/user_3G9osobYr0aAENArzSDrqEFJFgW"
PLATFORM="hf_20260824_011907_3212f21a-c433-4267-aeae-14da76d5ddfe.mp4"
BI="hf_20260824_011915_e8d3ed0c-815a-49c8-a06a-be037bb52bc9.mp4"

ok=0
fail=0

get() {
  local url="$1" out="$2" label="$3"
  printf '→ %s (%s)\n' "$out" "$label"

  # --fail turns an HTTP error into a non-zero exit instead of writing the error
  # body to disk; -L follows the CDN's redirects.
  if ! curl -fsSL "$url" -o "$out.part"; then
    printf '  ✗ download failed — the link may have expired.\n' >&2
    rm -f "$out.part"
    fail=$((fail + 1))
    return
  fi

  local size
  size=$(wc -c < "$out.part")

  # An HTML error page or a truncated download is small; a 10s 720p clip is not.
  if [ "$size" -lt 100000 ]; then
    printf '  ✗ only %s bytes — that is not a video.\n' "$size" >&2
    printf '     First bytes: %s\n' "$(head -c 60 "$out.part" | tr -d '\0')" >&2
    rm -f "$out.part"
    fail=$((fail + 1))
    return
  fi

  # Every MP4 carries "ftyp" in its box header. Checking it means a renamed
  # HTML page or a half-written file can never reach assets/ and silently break
  # the background — which is exactly the failure this script exists to avoid.
  if ! head -c 12 "$out.part" | grep -qa 'ftyp'; then
    printf '  ✗ not an MP4 (no ftyp box). Refusing to install it.\n' >&2
    rm -f "$out.part"
    fail=$((fail + 1))
    return
  fi

  mv "$out.part" "$out"
  printf '  ✓ %s KB\n' "$((size / 1024))"
  ok=$((ok + 1))
}

get "$BASE/$PLATFORM" assets/hero-platform.mp4 "platform — warm bulb"
get "$BASE/$BI"       assets/hero-bi.mp4       "MVP — blue bulb"

echo
if [ "$fail" -gt 0 ]; then
  cat >&2 <<'MSG'
Some downloads failed. Open the Higgsfield library and save the clips by hand,
under exactly these names — the case matters:

  assets/hero-platform.mp4   job 3212f21a-c433-4267-aeae-14da76d5ddfe
  assets/hero-bi.mp4         job e8d3ed0c-815a-49c8-a06a-be037bb52bc9

Then re-run this script to validate them, or commit them directly.
MSG
  exit 1
fi

echo "Both clips installed. Commit them:"
echo
echo "  git add assets/hero-platform.mp4 assets/hero-bi.mp4"
echo "  git commit -m 'Add the generated background clips'"
echo "  git push"
echo
echo "Netlify redeploys on push and the videos start playing."
