# ONE DIRECTION brand film: graphics in code, people on camera

**Decision.** The 88 s ONE DIRECTION film is built in two layers. Every
typographic, logo and light-line element is rendered by code
(`docs/clients/one-direction/render_film.py`). The human moments are plates
filmed at the client's real events. Narration is recorded by a human.

**Why.**
- Video models misspell wordmarks. This is the same lesson as the MWINDA brand
  loop (`scripts/render-brand-loop.py`).
- Scene 04 claims who speaks at ONE DIRECTION. Synthetic speakers would make
  that claim false, which contradicts the brief's own credibility rule.
- The code path is free, deterministic, and re-renders every format (16:9,
  9:16, 4:5) from one source. AI video for 88 s would exceed the current
  Higgsfield balance (201.8 credits), and it would still need the graphics layer.

**Open risks raised with the founder.** The client's name collides with a famous
registered music trademark (get a clearance opinion before the 4K finish). The
logo yellow (#FAE604) differs from the brief's #FFD400. The logo arrived only as
a raster, so a vector is needed for 4K.
