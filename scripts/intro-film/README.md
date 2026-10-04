# Intro film: ESTEVAO TATI M (90 s, 16:9)

A personal introduction film for Estevao Tati M, featuring MWINDA DIGITAL. It
is built as code, with no video-generation model: every frame is drawn by
`film.html` (canvas, a pure function of time), and every sound is synthesised
by `audio.py`. Names, titles, URLs and the logo are exact graphic layers in
every frame.

## Pipeline

| Step | File | Output |
|------|------|--------|
| Narration, one TTS call per caption phrase | `tts.py` (Kokoro-82M ONNX, voice `am_michael`) | `vo/*.wav`, `vo/vo.json` |
| Lay the voice on the 90 s timeline; scenes stretch to it | `timeline.py` | `timeline.json` |
| Picture: 8 scenes, 3840×2160, 30 fps | `film.html` + `render.mjs` + `render_all.sh` | `out/picture.mp4` |
| Sound-design cue sheet, exported by the picture | `node render.mjs events 1` | `events.json` |
| Original score, SFX, ducking, mix | `audio.py` | `out/mix.wav` |
| Subtitles from the placed narration | `subs.py` | `.srt` + `captions.ass` |

```bash
python3 tts.py && python3 timeline.py        # models/kokoro.onnx + voices.bin, see below
python3 -m http.server 8765 --bind 127.0.0.1 &
node render.mjs events 1 && ./render_all.sh  # ~12 min on 4 cores
python3 audio.py && python3 subs.py
# master: static gain + limiter, -16 LUFS / -1.5 dBTP
ffmpeg -i out/mix.wav -af "volume=2.4dB,alimiter=limit=0.79:attack=3:release=60:level=false" -c:a pcm_s24le out/mix_norm.wav
ffmpeg -i out/picture.mp4 -i out/mix_norm.wav -c:v copy -c:a aac -b:a 320k -movflags +faststart clean.mp4
ffmpeg -i clean.mp4 -vf "ass=out/captions.ass:fontsdir=fonts/ttf" -c:v libx264 -crf 17 -c:a copy captioned.mp4
```

Checking design: `STILLS=stills node render.mjs stills 1 9,40.6,74`, then
`python3 sheet.py 0 3 sheet.jpg stills` for a contact sheet.

Models, not committed: `kokoro-v1.0.onnx` and `voices-v1.0.bin` from the
`thewh1teagle/kokoro-onnx` GitHub release `model-files-v1.0`; the cutout used
rembg `isnet-general-use`.

## Rules this film keeps

- **No fabricated claims.** No clients, numbers, testimonials or product UIs.
  The Scene 4 workflow is labelled *Illustrative workflow*, and the Scene 5
  screens are abstract blocks.
- **The logo is the founder's own file** (`docs/brand-source/mwinda-logo.png`),
  keyed off black. It is never redrawn.
- **The presenter is the supplied photograph**: cut out, relit with a soft
  blue rim, given a slow breath-scale drift and camera moves. It is not
  animated into speech, so there is no lip sync and no generated gestures.
  The voice is a synthetic narrator and is not presented as his voice.
- Captions stay below y≈900 (of 1080); every title stays above that line.
