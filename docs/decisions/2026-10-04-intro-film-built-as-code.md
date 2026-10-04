# Intro film built as code, not with a video model

**Date:** 2026-10-04 · **Status:** done (v1)

## Decision

The 90 s introduction film is rendered from code (`scripts/intro-film/`):
canvas motion graphics, the founder's real photograph and logo, a local
neural TTS narrator, and a synthesised score. The founder explicitly asked
for this route instead of Higgsfield.

## Why

- **Text accuracy.** Generated footage misspells names and URLs. Here every
  string is a composited layer.
- **Licensing.** The music and SFX are synthesised in `audio.py`, so the
  soundtrack is owned outright.
- **Reproducible.** Change a line, re-run the pipeline, and get the same film.

## What it does not do (yet)

- **No talking presenter.** Lip sync and hand gestures need a generative
  avatar model, which would put words in a real person's mouth. The film uses
  the still portrait with camera motion instead. For a true on-camera version,
  record the founder against a dark backdrop (one take per scene) and drop
  the clips in place of the photo layers. The timeline and graphics already
  fit them.
- **Not his voice.** A synthetic narrator (Kokoro `am_michael`). Replace
  `vo/*.wav` with a real recording and re-run `timeline.py` onwards; scene
  timing follows the voice automatically.
- **No portfolio imagery.** estevaotati.com and mwindadigitalgroup.com were
  unreachable from the build sandbox, so Scene 5 uses abstract layouts.
