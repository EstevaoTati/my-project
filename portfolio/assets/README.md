# Pipeline d'assets — Portfolio Estevao / Mwinda

> **Portrait 3D actuel** : en attendant les clips, le hero anime la photo
> d'Estevao (`estevao-graded.jpg`, étalonnée nuit/ambre) dans un monolithe 3D
> qui tourne au scroll et s'incline à la souris. Une fois les 120 frames du
> clip 1 intégrées, garder ou retirer le bloc `#hero3d` dans `index.html`
> selon le rendu combiné.

Le site (`portfolio/index.html`) fonctionne dès maintenant avec des placeholders
élégants. Dès qu'un asset est déposé au bon endroit, il est détecté et intégré
automatiquement (aucune modification de code nécessaire).

## 1. Génération des 4 clips (Higgsfield · Seedance 2.0)

Paramètres communs : **mode std · 1080p · 16:9 · sans audio · ~8 s**.
Uploader d'abord la photo d'identité d'Estevao et la passer en **référence
d'identité sur chaque génération**. Tenue constante : t-shirt noir, surchemise
sombre, fin liseré ambre (bracelet ou lisière de surchemise) qui capte la lumière.

| # | Fichier cible | Prompt |
|---|---|---|
| 1 | `clips/hero-orbit.mp4` | A man stands upright, arms crossed, in an absolute black studio. A single warm amber light draws him in rim light; fine golden dust particles drift slowly. The camera performs a slow, perfectly fluid 360° orbit around him. Solemn, premium, afro-futurist cathedral-of-technology mood. Black t-shirt, dark overshirt, thin amber trim catching the light. No text, no logos. |
| 2 | `clips/builder.mp4` | The same man sits at a dark desk surrounded by floating holographic panels: Claude Code terminals, AI agent conversation streams, captured-leads curves — all in amber and emerald on deep night blue. Slow cinematic push-in over his shoulder. Solemn, premium. Same wardrobe: black t-shirt, dark overshirt, thin amber trim. |
| 3 | `clips/visionary.mp4` | A dark, elegant boardroom. The man stands before a wall of screens showing a glowing map linking Seattle to Kinshasa, Brazzaville, Paris, Montréal — amber lines of light crossing the Atlantic. Slow lateral tracking shot as he points at the map. Deep night blue, amber as the only dramatic light source, emerald data accents. Same wardrobe. |
| 4 | `clips/closer.mp4` | The man walks toward camera through a dark gallery lined with floating screens showing dashboards, platforms, book covers. He stops in a heroic pose as the screens blaze amber behind him. Cinematic, solemn, premium, afro-futurist. Same wardrobe: black t-shirt, dark overshirt, thin amber trim catching the light. |

## 2. Frames du hero (scrub au scroll, technique Lando Norris)

Extraire ~120 frames WebP du clip 1 :

```bash
./tools/extract-hero-frames.sh chemin/vers/hero-orbit.mp4
```

(ou manuellement : `ffmpeg -i hero-orbit.mp4 -vf "fps=15,scale=1280:-2" -c:v libwebp -quality 62 assets/hero/frame_%04d.webp`)

Le site attend `assets/hero/frame_0001.webp` → `frame_0120.webp`.
S'il y en a plus/moins, ajuster `FRAME_COUNT` dans `index.html`.

Remplacer aussi `assets/hero/og-frame.jpg` par une vraie frame du clip
(1200×630) pour l'Open Graph.

## 3. Clips des piliers (lazy-loaded)

Déposer, compressés pour le web (~2–4 Mo chacun) :

```bash
ffmpeg -i source.mp4 -an -vf scale=1280:-2 -c:v libx264 -crf 26 -preset slow -movflags +faststart assets/clips/builder.mp4
```

- `assets/clips/builder.mp4`   → section 01 · Mwinda Digital
- `assets/clips/visionary.mp4` → section 02 · Mwinda Consulting
- `assets/clips/closer.mp4`    → section 03 · L'Écosystème

Les placeholders disparaissent automatiquement dès que le fichier répond en HTTP 200.

## 4. Fond vidéo ambiant (déjà généré ✓)

Un clip technologique de 4 s (Seedance 1.5, fils de lumière ambre sur nuit
profonde) a été généré via Higgsfield et est référencé depuis son CDN dans
`index.html` (couche `.bg-ambient`, opacité 38 % sous un voile dégradé).

Pour l'auto-héberger (recommandé — l'URL CDN peut expirer) :

```bash
curl -L -o assets/clips/bg-tech.mp4 "https://d8j0ntlcm91z4.cloudfront.net/user_3G9osobYr0aAENArzSDrqEFJFgW/hf_20260719_053719_30b17f73-3199-47f6-aaf2-5d2d18699850.mp4"
```

Le code préfère automatiquement `assets/clips/bg-tech.mp4` s'il existe.
