# Holy Mountain Washington Church — website

Static site for **Holy Mountain Washington Church** / *Communauté Évangélique
Missionnaire La Montagne Sainte* (CEMMS · MSW). Plain HTML, CSS and JavaScript.
No build step, no framework, no external runtime dependency.

Deployed with the rest of the repo on Netlify. Live path: `/holy-mountain/`
(the short link `/church` redirects there).

```
holy-mountain/
├── index.html              the whole page
├── fetch-video.sh          pulls the animated logo clip into the repo
└── assets/
    ├── css/site.css        design system + layout
    ├── js/site.js          config, translations, interactions
    ├── fonts/              Anton + Inter, self-hosted (SIL OFL 1.1)
    ├── img/                emblem, photos, social card
    └── clips/              animated logo clip (served via netlify.toml proxy)
```

## Before it goes public — checklist

Everything editable lives in one block at the top of `assets/js/site.js`,
between the `▼▼ EDIT THIS BLOCK ▼▼` markers. Nothing else needs to be touched.

- [ ] **Service times** — `SITE.times`. The current values are examples.
- [ ] **Address** — `SITE.address`, and `SITE.mapsUrl` pointing at the venue.
- [ ] **Giving** — `SITE.giving.mobile` (Zelle / CashApp handle, or leave as is).
- [ ] **Social links** — `SITE.social`. Each one currently points at the
      platform's home page; replace with the church's own profile URLs
      (Instagram, Facebook, YouTube, TikTok).
- [ ] **Set `SITE.draft = false`** — this removes the amber banner at the top
      of the page. Leave it `true` while any value above is still an example.

## The animated logo

The 8-second clip in the hero was generated on Higgsfield from the emblem
alone, with no lettering anywhere in the frame. The rings turn continuously at
a constant speed, the globe keeps rotating, warm light breathes out from behind
the emblem, waves of blue light drift across the background as if wind were
moving through them, and dust rises through the air.

The camera is locked off and every motion runs at an even speed, so the clip
loops back on itself with no visible seam. It is set to loop natively in the
browser and restarts itself if playback ever stalls, so the animation runs
without stopping. The pause control in the corner of the frame is the only
thing that halts it, and visitors whose system asks for reduced motion get the
still frame instead.

It is **not** committed to the repo. `netlify.toml` proxies it from our own
domain, so the browser never contacts an external host:

```
/holy-mountain/assets/clips/msw-logo-8s.mp4  →  (Higgsfield CDN, status 200)
```

To stop depending on the CDN entirely, run `./fetch-video.sh` from this folder
and commit the downloaded file. The proxy rule uses `force = false`, so a local
file automatically wins over the redirect. The `<video>` tag falls back to
`assets/img/emblem-frame.jpg` if the clip cannot load, so the page never breaks.
That file is also the exact first frame of the clip, so the poster and the video
line up with no visible jump when playback starts.

## Languages

The page ships in English and switches to French from the EN/FR control in the
header. English text lives in `index.html`; French lives in the `FR` dictionary
in `assets/js/site.js`, keyed by the `data-i18n` attribute on each element. The
choice is remembered in `localStorage`, and visitors whose browser is set to
French get French on their first visit.

**To add or change a string:** put the English in `index.html` with a
`data-i18n="some.key"` attribute, then add `'some.key': '…'` to `FR`. Missing
keys fall back to English rather than breaking.

## The contact form

The form posts to **Netlify Forms** (`data-netlify="true"`), so submissions
appear in the Netlify dashboard under *Forms → contact* with no server to run.
Turn on email notifications there so the pastoral team is alerted. A hidden
honeypot field blocks most spam bots.

## Notes for whoever edits this next

- Photos are pre-sized: `*-sm.webp` for the gallery grid, `*.jpg` for the
  lightbox. Re-export at the same widths (600 / 1200) when adding more.
- `og-image.jpg` is what appears when the link is shared on WhatsApp,
  Facebook or Instagram. Regenerate it if the branding changes.
- The page respects `prefers-reduced-motion`: the animation, the marquee and
  the scroll reveals all stop for visitors who ask their system for less motion.
- Nothing loads from a third-party domain — fonts, scripts and images are all
  served from our own origin, which is what the site's Content-Security-Policy
  in `netlify.toml` enforces.
