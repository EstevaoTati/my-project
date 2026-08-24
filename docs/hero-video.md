# Background video — how to drop it in

The artwork is a **page-wide fixed layer** (`.site-bg`) on `index.html`,
`bi.html` and `os.html`: it sits behind the entire page and stays put while
content scrolls over it. It currently shows the founder-supplied bulb stills
with an infinite slow drift. Swapping in a video is a two-line change per
page, and the CSS is already written for it.

## Status: generated, not yet in the repo

Both clips exist on Higgsfield: Kling v3.0 from the founder's bulb stills,
1280×720, 16:9, **10 s**, **no audio**, `std` mode, cut to the founder's
beat-by-beat brief. 30 credits.

| Page | Job | File |
|---|---|---|
| `index.html` | `3212f21a-c433-4267-aeae-14da76d5ddfe` | `hf_20260824_011907_…mp4` |
| `bi.html` | `e8d3ed0c-815a-49c8-a06a-be037bb52bc9` | `hf_20260824_011915_…mp4` |

An earlier 5-second pair exists and is superseded.

**No audio, deliberately.** The briefs described sound — a hum, a click, a low
tone. A background video must be muted or the browser refuses to autoplay it,
so an audio track would cost credits for a channel no visitor will ever hear.

**The loop restarts rather than holding.** Both briefs open in darkness and end
in warm steady light, so a seamless loop is impossible by construction: it would
need the last frame to return to the first. The clip therefore reads as the bulb
re-igniting on each cycle, which suits "Bringing Light to Your Ideas". Forcing
seamlessness would mean ending dark, contradicting the brief.

They are **not in `assets/` yet**: the session that generated them could reach
Higgsfield's upload bucket but not its output CDN (`d8j0ntlcm91z4.cloudfront.net`
is refused by the egress policy), so the bytes could not be pulled down. That is
an organisation policy denial, not a bug to work around.

From any machine with normal internet access:

```bash
bash scripts/fetch-hero-videos.sh
```

It writes both files under the right names, refuses to keep a truncated or
error-page download, and prints the commit commands. If the CDN links have
expired, save the two clips from the Higgsfield library by hand under exactly
`assets/hero-platform.mp4` and `assets/hero-bi.mp4`.

### The CDN copy is a stand-in, not the plan

Each `<video>` carries two `<source>` elements: the local file first, the
Higgsfield CDN copy second. Browsers try them in order, so the clip plays today
instead of waiting for the download, and the moment `assets/hero-*.mp4` are
committed the local file wins and the third-party URL is never fetched.

**Remove the second `<source>` once the files are committed**, and drop the host
from `media-src` in `scripts/update-csp.mjs`. A background that depends on
someone else's CDN can be pulled out from under the site — that is the whole
reason the local file is listed first.

Verified both ways in a browser: with no local file the page falls through to
the CDN source, decodes frames, autoplays without a gesture and reaches full
opacity; with a local file present it plays that one and the CDN is **never
requested** (0 hits).

**One thing that could not be verified from here:** whether the CloudFront URL
is publicly readable. That host is refused by this environment's egress policy,
so the check has to happen in a real browser. If it turns out to need auth or to
expire, the failure is safe — `.video-ready` never fires and the poster stays,
exactly as today.

### A missing asset now 404s

`_redirects` and `netlify.toml` both send `/assets/*` to a **404** when no real
file matches, ahead of the SPA catch-all. Without that rule a missing or
mistyped asset answered with the whole of `index.html` at status **200**: the
browser downloaded the entire homepage on every visit while trying to decode it
as a video, and the failure was invisible in the network panel because the
request looked successful. Neither rule is forced, so every asset that exists is
still served normally — verified: the two JPGs return 200 `image/jpeg`, a
missing MP4 returns 404.

That also means the fetch script cannot be fooled by a catch-all response. It
checks two things beyond the HTTP status: a floor of 100 KB, and the `ftyp`
box every MP4 carries in its header. Tested against the homepage renamed to
`.mp4` (rejected on size) and the homepage padded past 200 KB (rejected on the
missing `ftyp` box — the case the size check alone would have let through).

### Proven to autoplay once the files exist

Not assumed — measured. With a real MP4 in place and Chromium's **default**
autoplay policy (no permissive flag), on both pages: the video reaches
`readyState 4`, starts with no user gesture, `currentTime` advances, the layer
flips to `video-ready`, opacity reaches 1, it covers the viewport, it loops, it
is muted, the CSS ignition retires and the poster stays underneath. 22
assertions, 0 failures.

The `<video>` elements are already in both pages and already point at those
paths, so nothing else has to change — until the files land, the poster shows
and the CSS ignition keeps running, which is exactly the behaviour today.

### The scrim lifts while a video plays

`.site-bg.video-ready .site-bg-veil` cuts the wash from 0.76–0.95 down to
0.36–0.80 (0.40–0.86 on phones). A background loop buried under a near-opaque
black layer is a cost with no benefit.

Going that light needs a second safeguard, because the MVP brief contains a
deliberate **burst of light**. Darkening the whole page to survive two seconds
of video would undo the point, so the protection travels with the glyphs
instead: a tight `text-shadow` on the hero headline, lede and eyebrow, applied
only under `.video-ready`. Invisible over dark frames, decisive over bright
ones.

Contrast is measured from rendered pixels, against a **full-frame white flare**
— far harsher than either real clip:

| Page | Contrast over white | WCAG |
|---|---|---|
| Platform | 13.8 : 1 | AAA |
| MVP | 10.9 : 1 | AAA |

## 1. Put the files here

| File | Page | Source artwork |
|---|---|---|
| `assets/hero-platform.mp4` | `index.html` | `assets/hero-platform.jpg` (warm bulb) |
| `assets/hero-bi.mp4` | `bi.html` | `assets/hero-bi.jpg` (blue tech bulb) |

Target: **1920×1080, H.264, no audio, 6–12 s, seamless loop, under 4 MB.**
A background video that weighs more than a few megabytes costs mobile users
real money and battery — compress hard, the veil hides most artefacts.

## 2. Add the element

In each page's `.site-bg` block, put the `<video>` immediately **before**
the existing `<img>`:

```html
<video autoplay muted loop playsinline
       poster="assets/hero-platform.jpg" preload="metadata">
  <source src="assets/hero-platform.mp4" type="video/mp4" />
</video>
<img class="site-bg-img" src="assets/hero-platform.jpg" alt="" />
```

`.site-bg video` already covers the viewport, sits above the poster, and is
**disabled entirely under `prefers-reduced-motion`**, where the still image
comes back. Nothing else to change.

**The swap is conditional on the video actually playing.** `script.js` (and
`bi.js` on the MVP) listens for the `playing` event and only then adds
`.video-ready` to the layer, which fades the video in and retires the CSS
ignition. The poster stays in the DOM underneath, permanently.

That matters because an earlier version keyed the swap off the mere presence
of the `<video>` element. A 404, a codec the browser rejects, a stalled
connection or a mobile browser refusing autoplay would each have hidden the
artwork and left a black rectangle behind the whole page. Now the worst case
is the background already shipping.

`assets/hero-platform.mp4` also serves `os.html`, which uses the same warm
artwork.

Attributes that matter: `muted` (browsers block autoplay without it),
`playsinline` (iOS plays inline instead of going fullscreen), `loop` (the
"forever" part), `preload="metadata"` (do not pull the whole file before the
page is usable).

## 3. Generating them

The brief was: *the bulb switching on, animated with pro UI/UX motion design*.
Higgsfield's `generate_video` with the bulb image as `start_image` is the
intended route. Keep the camera still and the loop seamless — a background
that pans or cuts fights the text in front of it.

Prompts that match the brief, one per page:

> **Platform (warm bulb).** A single filament light bulb switching on in a dark
> studio. The filament strikes, flickers once, then settles into a steady warm
> amber burn. Fixed camera, no pan, no cut, no text. Volumetric light haze,
> shallow depth of field, premium technology-brand look. The final frame
> matches the first so the clip loops seamlessly.

> **MVP (blue bulb).** The same bulb rendered in cool electric blue, switching
> on against near-black. Thin circuit-like light traces run up into the base as
> it ignites, then hold steady. Fixed camera, no pan, no cut, no text. Clean
> UI/UX motion-design feel. First and last frames identical for a seamless
> loop.

Ask for **no audio**: the file is muted in the browser regardless, and an audio
track is dead weight in a background loop.

## The Three.js hero is gone

`index.html` used to carry a gold wireframe icosahedron with orbital rings over
the hero, plus a full-page gold particle field, both drawn with Three.js. Both
were removed: the background artwork — and the video, once one is dropped in —
is now the only thing behind the page, and two competing gold light sources
fought each other for the reader's eye.

Consequences worth knowing:

- `index.html` no longer loads the three.js CDN script at all. That is the
  heaviest dependency the page had.
- `cdnjs.cloudflare.com` stays in the CSP because **`preview.html` still loads
  three.js**. That file is the self-contained snapshot of the site and does not
  track changes to the external assets — it is now stale in this respect, as
  `CLAUDE.md` warns it can be. Regenerate or retire it when convenient.
- The hero is not empty without it: `.site-bg` carries the bulb artwork with a
  46 s drift and a 7.5 s ignition loop, both running today.

## What is there in the meantime

Until an mp4 exists, `.hero-media-ignite` runs the ignition in CSS: a 7.5 s
loop where the filament strikes, flickers once, settles into a steady burn and
fades back down — the behaviour of a real incandescent bulb, deliberately slow
because it sits behind headline text. The BI page uses the same curve in
electric blue.

A *playing* video retires it: `.site-bg.video-ready .site-bg-ignite` is set
to `display: none`, because the video carries its own ignition. A video that
never starts leaves the CSS glow running.

## Content Security Policy

No change needed. `default-src 'self'` covers `media-src`, so self-hosted mp4
plays. A video from an external host would be blocked — keep it in `assets/`.
