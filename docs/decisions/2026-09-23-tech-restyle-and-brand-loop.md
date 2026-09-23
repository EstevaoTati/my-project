# 2026-09-23 — Tech restyle and the MWINDA brand loop

## Decision

1. Adopt the new MWINDA DIGITAL logo (gold wordmark, triangular "A") and the
   founder's four brand scenes across the platform, with every feature kept:
   site, AI Business Intelligence (`/bi`), MWINDA OS (`/os`).
2. One additive skin, `tech.css`, instead of rewriting `styles.css`/`bi.css`:
   Orbitron for display, Exo 2 for reading text, JetBrains Mono for labels;
   gold for brand, electric blue for AI; HUD corners, scanlines, grid.
3. The 20 s background video is **rendered programmatically**
   (`scripts/render-brand-loop.py`) from the real logo and scenes, one master
   per orientation, and plays on all three pages.

## Why

- **Fonts.** "100% tech" taken literally (Orbitron everywhere) makes French
  paragraphs unreadable; Orbitron is limited to headlines and short labels,
  long copy is in Exo 2 — still technical, built for reading.
- **Additive skin.** Swapping tokens through CSS variables keeps the diff
  reviewable and reversible (remove one `<link>` to roll back), and cannot
  break the MVP's JS-driven layout.
- **Programmatic video.** Video models redraw lettering in every frame; the
  wordmark shimmers and misspells. Compositing the actual logo is exact,
  seamless (seam measured at 0.18/255), reproducible, free to re-render, and
  lighter (2.8 MB desktop / 1.7 MB phone). A Higgsfield FLUX 3 Video clip was
  also generated (110 credits, founder-approved budget 140) — it sits in the
  founder's Higgsfield library; its download host is blocked from the build
  container, and its centred logo would collide with the desktop headline.
- **Composition.** The logo sits right on desktop (clear of the headline) and
  is dimmed on phones, where text must overlay it.

## Trade-offs

- ~4.5 MB of video across both masters (one is fetched per visitor);
  data-saver and reduced-motion visitors get the poster only.
- Orbitron loads from Google Fonts (already in the CSP); no new origins.

## Revisit if

- The founder wants the Higgsfield clip instead: replace
  `assets/mwinda-loop-landscape.mp4`, re-extract its poster, re-check the hero.
