# MWINDA films — promo film and investor pitch film

~83 s, 1920×1080, 30 fps, French and English. Motion design in plain
HTML/CSS (`film.html`), rendered frame by frame — every frame is a pure
function of time, so a render is exact and repeatable. Product footage is
**real screenshots of the running app** filled with a demo project
(`demo-project.mjs`). The soundtrack is synthesized (`soundtrack.py`): no
samples, no licences to clear.

Why not an AI video model: it cannot render readable text or an exact
wordmark, and this film is mostly text and real UI.

## The two films

- `film.html` — promo film (~83 s, FR/EN): platform + AI Business Intelligence walkthrough.
- `pitch.html` — investor pitch film (~104 s, FR): the 3/4 failure statistic and its causes
  (sourced on screen), MWINDA, the five divisions, the solution, the deliverable, each cause
  answered, differentiators, footprint, business model, MWINDA OS, call to action.
  Render with `FILM=pitch`; soundtrack with
  `BASS_IN=5.6 ARP_IN=13 DRUMS_IN=13 HATS_IN=22 python3 soundtrack.py pitch-cues.json pitch-soundtrack.wav`.

## Scenes (promo film)
Hook → logo → five divisions + two products → AI Business Intelligence flow →
steps 01-05 (describe, read the analysis, ⚡ complete dossier, fine-tune,
download the PDF) → tips → MWINDA OS → call to action.

## Rebuild

```bash
# 1. product screens (needs the BI harness server running)
cd ../bi-harness && npm install && npm run server &
cd ../promo-film
CHROMIUM=… node capture.mjs                 # -> shots/*.png + demo-dossier.pdf
CHROMIUM=… node pdf-pages.mjs demo-dossier.pdf 1,2,4
# offline sandbox: FONTS_CSS=<local @font-face css> GSAP_DIR=<gsap dist dir>

# 2. sound cues + soundtrack
node render.mjs cues fr                     # -> cues.json (scene/click/tick times)
python3 soundtrack.py cues.json soundtrack.wav   # needs numpy

# 3. picture, then mux
FFMPEG=… node render.mjs video fr           # -> mwinda-film-fr-silent.mp4
FFMPEG=… node render.mjs video en
ffmpeg -i mwinda-film-fr-silent.mp4 -i soundtrack.wav -c:v copy -c:a aac -b:a 192k -shortest mwinda-film-fr.mp4

# preview single frames while editing
node render.mjs preview fr 3.4,30.9,61.3
```

Call-to-action URL: `URLCTA=yourdomain.com/bi node render.mjs video fr`
(defaults to the current Netlify address).
