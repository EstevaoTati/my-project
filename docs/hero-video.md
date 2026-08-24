# Background video — how to drop it in

The artwork is a **page-wide fixed layer** (`.site-bg`) on `index.html`,
`bi.html` and `os.html`: it sits behind the entire page and stays put while
content scrolls over it. It currently shows the founder-supplied bulb stills
with an infinite slow drift. Swapping in a video is a two-line change per
page, and the CSS is already written for it.

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
