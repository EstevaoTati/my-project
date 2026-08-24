# Background video — how to drop it in

The artwork is a **page-wide fixed layer** (`.site-bg`) on `index.html`,
`bi.html` and `os.html`: it sits behind the entire page and stays put while
content scrolls over it. It currently shows the founder-supplied bulb stills
with an infinite slow drift. Swapping in a video is a two-line change per
page, and the CSS is already written for it.

## Status: generated, not yet in the repo

Both clips exist on Higgsfield, generated with Kling v3.0 from the founder's
bulb stills — 1280×720, 16:9, 5 s, **no audio**, `std` mode, and the same image
passed as both `start_image` and `end_image` so the last frame returns to the
first and the loop has no visible seam. 15 credits.

| Page | Job | Download |
|---|---|---|
| `index.html` | `c520a369-f76c-434d-b275-02a07e2d6607` | `hf_20260824_010122_c520a369-f76c-434d-b275-02a07e2d6607.mp4` |
| `bi.html` | `7ea6e8c5-3f8c-4a73-ba09-4a7561069a3d` | `hf_20260824_010047_7ea6e8c5-3f8c-4a73-ba09-4a7561069a3d.mp4` |

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

`.site-bg.video-ready .site-bg-veil` reduces the wash from 0.76–0.95 to
0.60–0.90 (less again on phones). A background loop buried under a near-opaque
black layer is a cost with no benefit. The lift is modest on purpose: headings
sit exactly where the centre of that gradient falls, and washing them out was a
real regression once before. Contrast was re-measured from rendered pixels over
the playing video — **18:1 on the platform, 16.6:1 on the MVP**, both past WCAG
AAA — rather than eyeballed.

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
