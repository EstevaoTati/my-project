# ONE DIRECTION — "Where Destinies Are Made" · brand film production bible

Client brief: an 88 s cinematic brand film (16:9 master, 9:16 and 4:5 recomposed),
black / yellow / white, built on the arc **uncertainty → direction**.
Status as of 2026-10-18: **motion-design master v1 rendered**, with a temp score,
all 7 scenes and the final logo reveal. It is not the release film yet: the
live-action plates and the narrator still have to be supplied.

## Read first: three risks to settle before more money goes in

1. **The name.** "One Direction" is the name of one of the best-known music acts
   in the world, and it is registered as a trademark in many countries for
   entertainment services and merchandise. Conferences and events are an
   entertainment/education service. The film itself is not the exposure. The
   exposure is the brand: a cease-and-desist after launch would void every asset,
   this film included. Search results will also be dominated by the band, so
   the film's YouTube and SEO reach will be weak. **Get a trademark clearance
   opinion in the client's operating countries before the 4K finish.** (This is a
   flag, not legal advice.) If the name has to change, the renderer only needs a
   new logo file and new strings.
2. **The yellow.** The brief specifies `#FFD400`, but the supplied logo file is
   `#FAE604` (measured). They are visibly different side by side. The film keeps
   the logo at its own colour and uses `#FFD400` for everything else. **The client
   should pick one.** It is a one-line change in `render_film.py`.
3. **The logo is a 1254 px raster.** That is fine for 1080p. A 4K master and a
   conference LED wall need the **vector original (SVG / AI / PDF)**, so ask for it.
   The bold version (image 2) is used, because the brief asks for a bold
   geometric wordmark. The script version is available as an alternate end card.

## How the film is built and why

| Layer | Made by | Why |
|---|---|---|
| Typography, logo, yellow line, 3D crossroads, beam, kinetic words | `render_film.py` (code, deterministic) | Video models cannot spell. The wordmark must be exact in every frame. |
| Live-action moments (scenes 02, 04, end of 05) | **plates**: `plates/<id>.jpg` | Brief: "avoid stock aesthetics". Real people at real ONE DIRECTION events are the only credible way to show *who speaks there*. |
| Narration | human VO artist, recorded against `narration.srt` | Brief: "avoid robotic delivery". |
| Score | temp: `render_sound.py` (synthesised) → release: composed or licensed | The temp track locks timing. Its hit points are the composer's brief. |

Without a plate the slot renders a labelled slate (`PLATE 04B · CLOSE-UP ·
ENTREPRENEUR SPEAKING`). Drop the shot in as `plates/04B.jpg` and it is graded
into the brand (crushed blacks, warm highlights) and given a slow push-in. A
still is enough for an animatic. For the release, replace the stills with video
plates in the edit (Premiere/Resolve), using the rendered master as the
graphics layer.

**Credibility rule for scene 04:** do not use AI-generated "ministers",
"speakers" or "audiences". The scene claims that these people speak at ONE
DIRECTION. Synthetic faces make the claim untrue, and that contradicts the
brief's own "the brand must remain credible". AI plates are acceptable for
scene 02 only (anonymous personas, not presented as attendees).

## Edit — timecodes are final for v1

| TC | Scene | On screen | Plates |
|---|---|---|---|
| 00:00–00:12 | 01 The Question | single yellow light → aerial crossroads, 6 roads, lone figure; LIFE IS FULL OF CHOICES. / BUT WHICH DIRECTION? | — |
| 00:12–00:25 | 02 The Human Search | QUESTIONS. DECISIONS. UNCERTAINTY. POSSIBILITIES. Plates cut on a travelling yellow line. | 02A student · 02B entrepreneur · 02C professional · 02D seeker · 02E emerging leader |
| 00:25–00:37 | 03 The Light | beam slices the black → becomes a path; fragmented lines converge; camera flies past CLARITY. WISDOM. VISION. → DIRECTION. | — |
| 00:37–00:53 | 04 The Voices | conference montage; lower-third roles ENTREPRENEURS / INDUSTRY EXPERTS / PEOPLE OF FAITH / MENTORS | 04A wide stage · 04B speaker CU · 04C audience · 04D minister · 04E one-on-one · 04F slow-mo applause |
| 00:53–01:06 | 05 The Experience | 7 words travel toward camera through streaming lines: CONFERENCES. MENTORSHIP. LEADERSHIP. FAITH. BUSINESS. PURPOSE. GROWTH. → audience under warm beams | 05Z audience in yellow light |
| 01:06–01:17 | 06 The Transformation | same crossroads; one road lights to the horizon; the figure walks it; camera rises to aerial; YOUR FUTURE NEEDS DIRECTION. / YOUR JOURNEY STARTS HERE. | — |
| 01:17–01:28 | 07 The Reveal | the line accelerates and stops dead at frame centre; impact; ONE wipes on behind a light edge; DIRECTION opens from centre; WHERE DESTINIES ARE MADE | — |

There is one recurring device, the yellow line: first light → plate wipes →
beam → lit road → the stroke that becomes the logo. Nothing else transitions.

## Narration

The script is the brief's script verbatim, cued in `narration.srt`, about 2.4 words
per second, with pauses. Casting: warm, mid-low register, documentary pace,
not a preacher or trailer voice. Record 48 kHz/24-bit, dry. Duck the music
6–8 dB under the voice. The temp score sits at -19 LUFS, which leaves the
headroom for this.

The concept section's opening line ("What if the greatest challenge in life
isn't the absence of opportunities…") is **not** in the storyboard VO. It is the
stronger 3-second hook, so cut a version that opens on it for social.

## Shooting the plates (cheapest credible route)

Shoot at the next ONE DIRECTION event with one camera operator and one gimbal:
24 fps, 1/48 shutter, log profile, 4K. Get signed releases from every
recognisable face. Shot list = plate IDs above, plus wide and close-up of each,
5–8 s holds. Stage lighting: ask the venue for warm amber/yellow washes. That
matches 05Z and the brand.

## Formats

| Deliverable | Spec | Status |
|---|---|---|
| Master 16:9 | 1920×1080, 24 fps, H.264 CRF 16 | v1 rendered |
| Vertical 9:16 (Reels/TikTok/Shorts) | 1080×1920, re-laid-out (not cropped): wider logo, type re-wrapped and repositioned | v1 rendered |
| 4:5 (Instagram/Facebook feed) | 1080×1350 | `python3 render_film.py square45` |
| Conference screen / 4K | 3840×2160 ProRes 422 HQ | needs the vector logo; set `FORMATS` to 4K |

## Rebuild

```bash
cd docs/clients/one-direction
python3 render_film.py landscape --still 81 84   # check frames
python3 render_film.py landscape                 # video  -> out/
python3 render_sound.py                          # score  -> out/
ffmpeg -i out/one-direction-landscape-video.mp4 -i out/one-direction-temp-score.wav \
  -c:v copy -c:a aac -b:a 320k -af loudnorm=I=-14:TP=-1 -shortest out/one-direction-16x9.mp4
```

Needs Python 3, Pillow, NumPy, ffmpeg. Fonts: Montserrat (OFL, in `fonts/`),
the geometric sans closest to the brief's Futura/Gotham/Century Gothic.
Renders go to `out/`, which is git-ignored (it is large and fully reproducible).
