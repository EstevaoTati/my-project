# Background video

The artwork is a **page-wide fixed layer** (`.site-bg`) on `index.html`,
`bi.html` and `os.html`: it sits behind the entire page and stays put while
content scrolls over it. All three pages play the same brand loop.

| File | Used when | Size |
|---|---|---|
| `assets/mwinda-loop-landscape.mp4` | viewport aspect ≥ 4:5 (desktop, tablet, landscape phone) | 1920x1080, ~2.8 MB |
| `assets/mwinda-loop-portrait.mp4` | anything narrower (portrait phone) | 720x1280, ~1.7 MB |
| `assets/mwinda-loop-{landscape,portrait}.jpg` | poster / reduced motion / no video | frame 0 of each |

**20 s, 24 fps, H.264 Main 4.0, fast-start, no audio track, seamless loop.**
The `<video>` carries two `<source>`s: landscape first with
`media="(min-aspect-ratio: 4/5)"`, portrait second. A browser that ignores
`media` on `<source>` takes the landscape one, which is merely cropped harder on
a phone — never a broken page. The poster `<picture>` makes the same choice.

## How the loop is made — and why not by a video model

`scripts/render-brand-loop.py` renders both masters from the brand's own files:
the logo (`docs/brand-source/mwinda-logo.png`) and the four brand scenes
(`docs/brand-source/scene-*.{png,jpg}`), originals kept out of the served tree.

```bash
npm i ffmpeg-static   # in a scratch dir; any ffmpeg on PATH works too
pip install Pillow
FFMPEG=/path/to/ffmpeg python3 scripts/render-brand-loop.py landscape portrait
```

Scenario (the brief: premium, tech, silent, calm where the headline sits):

| t (s) | Beat | Move |
|---|---|---|
| 0–3 | Logo in the dark, gold light sweeps across the wordmark | slow push |
| 3–7 | MWINDA HQ — the reception | push in |
| 7–11 | The identity on every device | lateral pan |
| 11–15 | The AI desk — dashboards, the model at work | push, rising |
| 15–18 | The data globe — the reach | pull back |
| 18–20 | Back to the logo | eases to the exact first frame |

0.8 s cross-fades between beats; every move is smoothstep-eased so it lands at
zoom 1.00 on the seam. Measured on the encoded files: first vs last frame mean
difference **0.18/255** (landscape) and **0.30/255** (portrait) — invisible.

**Why programmatic.** A video model cannot render lettering: every generated
frame redraws "MWINDA DIGITAL" slightly wrong, and a logo that shimmers is worse
than no logo. Compositing the real logo file keeps it exact in every frame, and
the output is reproducible, versioned and free to re-render. A Higgsfield clip
(FLUX 3 Video, 1280x720, 20 s, logo as first and last frame) was also generated
on the founder's account; it lives in their Higgsfield library. To use it, drop
the downloaded mp4 in as `assets/mwinda-loop-landscape.mp4` and re-extract the
poster from frame 0 — note its logo is centred, so it will sit behind the
headline on desktop.

**Composition rules the script enforces.** Landscape: logo at 30% of frame
width, centred at 75% across — clear of the headline column on the left.
Portrait: 74% width, brightness 0.62, so the hero copy reads over it. Portrait
scenes are set full height on a blurred, darkened extension of themselves (no
hard edges); the light sweep is masked to the logo only.

Posters are extracted from the encoded files, never from the script, so the
poster-to-video reveal cannot jump:

```bash
ffmpeg -i assets/mwinda-loop-landscape.mp4 -frames:v 1 -q:v 3 assets/mwinda-loop-landscape.jpg
```

**No audio, deliberately.** A background video must be muted or the browser
refuses to autoplay it; on iOS a file with no audio track is the strongest
position autoplay can be in.

### No drift on the video

`.site-bg-img, .site-bg video` share a 46 s `siteDrift`; the video overrides it
(`animation: none; transform: none`). The loop moves on its own, and
transforming a full-viewport video every frame is GPU and battery for nothing.

## The playback logic lives in one file

`video-bg.js`, loaded by `index.html`, `bi.html` and `os.html`. It used to be duplicated
inside `script.js` and `bi.js`; two copies of this drift, and only one of them
gets the next fix. Both of those files now carry a one-line pointer instead.

It picks up `.site-bg video` and `.hero-media video`, so a page gets the full
behaviour by loading the script — there is nothing to wire per page.

`<video autoplay muted loop playsinline>` is the starting point, not the answer.
What actually stops a background video in the field:

- iOS **Low Power Mode** refuses programmatic `play()` outright.
- Firefox and Safari block autoplay **per site** once a user opts in.
- Android **data savers** refuse to fetch it.
- Chrome **freezes background tabs** and does not always resume media.
- Safari restores a **bfcache** page with the video paused.
- A decoder dropped under memory pressure leaves a frozen frame and **emits no
  event at all**.

Each of those leaves a still image that looks like a bug. So the module reacts
to every signal that playback stopped, polls for the ones that emit no signal,
and when the browser has genuinely refused, waits for a human gesture instead of
hammering an API that will keep saying no.

### What it sets, and why both ways

`muted`, `loop`, `playsInline`, `webkit-playsinline`, `disableRemotePlayback`
are set as **properties and attributes**. Safari gates autoplay on the muted
*property* at `play()` time while the parser gates on the *attribute*, and an
edit that drops one of them should not silently break playback.
`webkit-playsinline` covers older iOS and in-app WebViews (Instagram, Facebook,
Gmail), where a video without it goes fullscreen on play.
`disableRemotePlayback` keeps a background loop out of AirPlay and cast pickers.

### The signals it listens to

`pause`, `ended` (fires if `loop` is ever lost), `stalled`, `suspend`,
`visibilitychange`, `pageshow` with `persisted` (bfcache restore), and the Page
Lifecycle `resume` event (Chrome unfreezing a background tab).

### The watchdog, for the stalls that emit nothing

Every 4 s: if the video is paused, restart it; if it reports *playing* but
`currentTime` has not moved since the last check and `readyState >= 2`, the
decoder is wedged — re-seek to 0 and play. The interval clears itself once the
element leaves the DOM.

### When the browser has said no

Three rejected `play()` calls is a policy, not a hiccup. At that point the
module stops calling `play()` and listens once for the first human gesture of
any kind — `touchstart`, `pointerdown`, `click`, `keydown`, `scroll` — then
plays and stands down. This is the iOS Low Power Mode path and the
per-site-blocked path in Safari and Firefox.

### Where it deliberately does nothing

- **`prefers-reduced-motion: reduce`** — the video is never started, `autoplay`
  is removed and `preload` set to `none`. A preference changed *after* load is
  honoured live through a `change` listener.
- **`saveData`, or an effective connection type of 2g/slow-2g** — same. A
  metered connection is a real cost to a real person, and the poster is a
  complete experience.
- **A hidden tab** — `play()` is not called while `document.hidden`.

### The poster is never removed

`.video-ready` is added to the layer **only on the `playing` event**, which is
what fades the video in and retires the CSS ignition. The `<img>` stays in the
DOM underneath, permanently. A 404, a rejected codec, a stalled connection or a
refused autoplay each leaves the artwork showing rather than a black rectangle.

An earlier version keyed the swap off the mere *presence* of the `<video>`
element, so any of those failures hid the background entirely.

## Proven, not assumed

Measured with Playwright against a local server that emulates the Netlify rules
(404s, pretty URLs, byte ranges), on the earlier clips. The loop changed the
files, not the element or `video-bg.js`, so these still describe the behaviour.

| Suite | What it breaks | Result |
|---|---|---|
| Autoplay | default Chromium autoplay policy, no permissive flag | 22 assertions, 0 failures |
| Mobile attributes | muted/playsinline/loop/`webkit-playsinline`/`disableremoteplayback`, data saver, reduced motion | 13 / 0 |
| Low power | `--autoplay-policy=document-user-activation-required`; then `autoplay` stripped **and** `play()` rejected | 14 / 0 |
| Lifecycle | bfcache restore, tab freeze + `resume`, `stalled` | 6 / 0 |
| Forever | external pause, `loop` removed and run to the end, wedged decoder | 12 / 0 |

The Low Power suite is the one worth reading twice. A first attempt at it was
**invalid**: Chromium always allows muted autoplay, and the stub only blocked
programmatic `play()`, so the declarative `autoplay` attribute started the video
and the test passed for the wrong reason. The real test rewrites the HTML in
flight to strip the attribute *and* rejects `play()`. Under that: nothing is
marked ready, the artwork stays, attempts stop climbing (1 → 2 over 5 s rather
than a loop of retries), and the first touch starts it and flips the layer to
`video-ready`.

### Playing them in the sandbox, and looking at them

The Chromium build available here is the open-source one: no proprietary
codecs, so it answers `DEMUXER_ERROR_NO_SUPPORTED_STREAMS` on H.264 and cannot
play these files. For a long time that meant nobody working on this repo had
ever *seen* the clips, and the framing bug above went unnoticed for weeks — the
source stills were measured as a proxy instead.

**ffmpeg removes that blind spot.** `npm i ffmpeg-static` puts a binary in the
scratch directory that decodes H.264 perfectly, so frames can be extracted and
looked at, and a browser crop can be reproduced exactly:

```bash
# a frame (the old square clips; for the 16:9 master scale=1440:-2 instead)
ffmpeg -ss 4 -i assets/mwinda-loop-landscape.mp4 -frames:v 1 frame.png
ffmpeg -i frame.png -vf "scale=1440:1440,crop=1440:900:0:205" desktop.png
# and on a phone: 390x844
ffmpeg -i frame.png -vf "scale=844:844,crop=390:844:227:0" phone.png
```

Do this before trusting any claim about how a background clip is framed. The
playback tests still need a decodable stand-in (`WORST_CASE=1` in `serve.mjs`),
because the *browser* still cannot play H.264 here.

## A missing asset 404s

`_redirects` and `netlify.toml` both send `/assets/*` to a **404** when no real
file matches, ahead of the SPA catch-all. Without that rule a missing or
mistyped asset answered with the whole of `index.html` at status **200**: the
browser downloaded the homepage on every visit while trying to decode it as a
video, and the failure was invisible in the network panel because the request
looked successful. Neither rule is forced, so every asset that exists is still
served normally.

## Legibility over a moving image

*Written for the earlier bulb clips; the rules carried over unchanged. The new
loop keeps its bright subject (the logo) on the right on desktop and dims it on
phones, and `tech.css` gives the MVP step rail a near-solid plate where it
crosses the logo.*

`.site-bg.video-ready .site-bg-veil` keeps only a directional gradient — dark
where the copy sits, near-clear over the bulb — instead of a flat scrim. What
each page needs behind its text was settled by measuring the artwork the clips
are generated from (the one thing that could be decoded in the sandbox):

| | Text column, median | 95th percentile | Unaided contrast |
|---|---|---|---|
| Platform | 0.004 | 0.055 | **8.9 : 1** |
| MVP | 0.023 | 0.537 | **1.6 : 1** |

- **The MVP keeps a panel.** Its artwork has a bright region overlapping the
  text column, where light copy would otherwise sit at 1.6:1.
- **The platform gets a black layer under every section below the hero**, added
  later on the founder's instruction: sections and footer take a near-opaque
  `rgba(5,5,7,.90→.94)` with a 6 px blur while `body.has-video-bg` is set, so
  copy scrolling over the clip is always read against black.

### Two traps in this area

**`.gold-text` rendered black.** It paints a gradient through
`background-clip: text` with `color: transparent`; a `text-shadow` added for
legibility showed *through* the glyphs, so "Light" rendered as a black word on a
dark video. Under `has-video-bg` the gradient is dropped for solid white.

**The aggregate contrast metric lied.** It compares the brightest and darkest
pixels in an element's box and assumes the brightest are the glyphs. Over a
bright subject with gold type that assumption inverts: it reported a comfortable
ratio for hero buttons that were visibly washing out over the bulb, and later
reported a *worse* number after both darkening the backdrop and whitening the
label — an impossible direction. For anything sitting over the bulb, look at the
render.

## The Three.js hero is gone

`index.html` used to carry a gold wireframe icosahedron with orbital rings over
the hero, plus a full-page gold particle field. Both were removed: the video is
now the only thing behind the page, and two competing gold light sources fought
each other for the reader's eye.

- `index.html` no longer loads the three.js CDN script at all — the heaviest
  dependency the page had.
- `cdnjs.cloudflare.com` is **gone from the CSP**. It was only ever there for
  the three.js that `preview.html` loaded, and that page has been retired —
  it had drifted so far it still showed the removed 3D shapes and the old
  "MWINDA GROUP" name. `/preview` now 301s to `/`.

## The CSS ignition is retired

`.site-bg-ignite` was a bulb glow in CSS for when no video played. The brand is
the wordmark now and the poster already carries it, so `tech.css` sets
`.site-bg-ignite { display: none }`. The element stays in the markup (harmless)
so the old stylesheets need no edits.

## Content Security Policy

No change needed. `default-src 'self'` covers `media-src`, so a self-hosted mp4
plays. A video from an external host would be blocked — keep it in `assets/`.
