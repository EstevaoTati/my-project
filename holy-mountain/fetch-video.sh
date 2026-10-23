#!/usr/bin/env bash
# Pull the animated logo clip (generated on Higgsfield) into the repo so the
# site no longer depends on the CDN at all. Optional: netlify.toml already
# proxies the same file from our own domain.
set -euo pipefail
cd "$(dirname "$0")"
URL="https://d8j0ntlcm91z4.cloudfront.net/user_3G9osobYr0aAENArzSDrqEFJFgW/hf_20260905_014712_4f0fe8f8-d359-462a-9690-67b6311b9e39.mp4"
mkdir -p assets/clips
echo "Downloading the animated logo clip…"
curl -fL --retry 3 -o assets/clips/msw-logo-8s.mp4 "$URL"
ls -lh assets/clips/msw-logo-8s.mp4
cat <<'EOF'

Done. Redeploy and the site serves this local file.
If it is larger than ~5 MB, compress it first:
  ffmpeg -i assets/clips/msw-logo-8s.mp4 -an -vf scale=1280:-2 -c:v libx264 \
    -crf 28 -preset slow -movflags +faststart assets/clips/msw-web.mp4
  mv assets/clips/msw-web.mp4 assets/clips/msw-logo-8s.mp4
EOF
