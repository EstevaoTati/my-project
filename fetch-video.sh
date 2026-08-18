#!/usr/bin/env bash
# Rapatrie la vidéo de fond 3D (générée sur Higgsfield) dans le paquet,
# pour ne plus dépendre du tout du CDN. Optionnel : le site fonctionne
# déjà sans, grâce au proxy déclaré dans netlify.toml.
set -euo pipefail
cd "$(dirname "$0")"
URL="https://d8j0ntlcm91z4.cloudfront.net/user_3G9osobYr0aAENArzSDrqEFJFgW/hf_20260730_005955_b7dfa171-e171-4ecd-8108-44f7dc4af7a8.mp4"
mkdir -p assets/clips
echo "Téléchargement de la vidéo de fond…"
curl -fL --retry 3 -o assets/clips/bg-tech.mp4 "$URL"
ls -lh assets/clips/bg-tech.mp4
echo
echo "Terminé. Redéployez le dossier : le site servira ce fichier local."
echo "Si le fichier dépasse ~5 Mo, compressez-le :"
echo "  ffmpeg -i assets/clips/bg-tech.mp4 -an -vf scale=1280:-2 -c:v libx264 \\"
echo "    -crf 28 -preset slow -movflags +faststart assets/clips/bg-tech-web.mp4"
echo "  mv assets/clips/bg-tech-web.mp4 assets/clips/bg-tech.mp4"
