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

- [ ] **Service time** — `SITE.times.sunday`. The current value is an example.
      Only the Sunday service is listed. Nothing else on the page claims a
      weekly programme, so add a card to the visit section (and an entry to
      `SITE.times`) only for a gathering that actually runs.
- [ ] **Address** — `SITE.address`, and `SITE.mapsUrl` pointing at the venue.
- [ ] **Giving** — `SITE.giving.mobile` (Zelle / CashApp handle, or leave as is).
- [ ] **Social links** — `SITE.social`. Each one currently points at the
      platform's home page; replace with the church's own profile URLs
      (Instagram, Facebook, YouTube, TikTok).
- [ ] **Leadership bios** — the two paragraphs in the leadership section are
      written from the role, not from anyone's own history, precisely so that
      nothing was invented. Replace them with the pastor's own words. They are
      in `index.html` (`data-i18n="lead.d1"` and `lead.d2`) with the French in
      the `FR` dictionary in `assets/js/site.js`.
- [ ] **Set `SITE.draft = false`** — this removes the amber banner at the top
      of the page. Leave it `true` while any value above is still an example.

## Security

The site is static: there is no application server, no database and no
credentials anywhere in this folder, which removes most of the attack surface
before anything is written. What remains is hardened in `netlify.toml` under
`for = "/holy-mountain/*"`:

| Header | What it stops |
| --- | --- |
| `Content-Security-Policy` | The main one. Scripts and styles load only from our own origin, so injected markup cannot execute. |
| `frame-ancestors 'none'` / `X-Frame-Options: DENY` | Clickjacking: nobody can embed the site in a hidden frame over their own buttons. |
| `form-action 'self'` | A script cannot redirect the contact form to somebody else's server. |
| `base-uri 'none'` | A `<base>` tag cannot be injected to re-point every relative URL. |
| `object-src 'none'` / `frame-src 'none'` | No plugins, no embedded frames. |
| `X-Content-Type-Options: nosniff` | The browser will not re-interpret a file as script because its bytes look like one. |
| `Referrer-Policy` | The full URL is not leaked to other sites. |
| `Permissions-Policy` | Camera, microphone, location and the rest are denied to the page outright. |
| `Cross-Origin-Opener-Policy` / `-Resource-Policy` | Other origins cannot hold a handle on our window or hotlink our assets. |
| `Strict-Transport-Security` | The browser refuses plain HTTP for two years. |

**Two rules keep that policy working.** The policy allows no inline script and
no inline style, which is what makes it worth having.

1. The page contains exactly one inline script, the JSON-LD block, allowed by
   its SHA-256 hash. **Edit that block and you must run
   `./tools/csp-hash.sh`** and paste the printed line into `netlify.toml`.
2. There are no `style="..."` attributes anywhere. Every rule lives in
   `assets/css/site.css`. Adding one inline style would force
   `'unsafe-inline'` back into the policy and undo most of its value.

**What this does not do.** Headers protect visitors' browsers. They do not
protect the accounts that can change the site. The real risk to a small church
site is a stolen password, so put two-factor authentication on the Netlify
account, on the GitHub account and on the Gmail address the form notifies, and
keep the number of people with deploy access small.

The contact form is spam-filtered by Netlify and by a honeypot field that a
human never sees. If spam still gets through, turn on Netlify's own filtering
level in the dashboard before adding a CAPTCHA: a CAPTCHA loads Google code,
which the policy above deliberately forbids.

## The animated logo

The clip plays in three places: full-bleed behind the hero, and softened to a
watermark behind the vision and contact sections. One control in the corner of
the hero pauses all three at once and the choice is remembered.

Only the clip you are looking at ever plays. The others are paused, and the two
background copies are not even downloaded until they scroll into view. On a
phone, or when the browser reports Save-Data, they are never downloaded at all
and only the hero clip runs. Nothing autoplays for a visitor whose system asks
for reduced motion, and the pause control hides itself for them because there
is nothing left to pause.

The 8-second clip plays full-bleed as the background of the hero. It was
generated on Higgsfield from the emblem alone, with no lettering anywhere in
the frame, which is what lets it sit behind the headline without two sets of
words competing. The rings turn continuously at
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

On success the visitor lands on `thanks/`, a page of ours rather than Netlify's
default confirmation. It is marked `noindex`, so it will not turn up in search
results on its own.

Validation is layered. The browser enforces `required`, `type="email"` and
`maxlength` on its own; JavaScript adds inline, translated messages that a
screen reader announces and blocks a double submit; Netlify validates again on
receipt. Turning JavaScript off degrades the messages, not the form.

## Notes for whoever edits this next

- Photos are pre-sized: `*-sm.webp` for the gallery grid, `*.jpg` for the
  lightbox. Re-export at the same widths (600 / 1200) when adding more.
- Leadership portraits (`pastor-israel-kalakala`, `couple-kalakala`) are cropped
  to 4:5 at 1000px. Keep that ratio when swapping them: the cards stack to a
  single column on phones and the portrait crop is what stops heads being cut.
- The proper names in the leadership cards are deliberately identical in both
  languages. Only the role labels are translated.
- `og-image.jpg` is what appears when the link is shared on WhatsApp,
  Facebook or Instagram. Regenerate it if the branding changes.
- The page respects `prefers-reduced-motion`: the animation, the marquee and
  the scroll reveals all stop for visitors who ask their system for less motion.
- Nothing loads from a third-party domain — fonts, scripts and images are all
  served from our own origin, which is what the site's Content-Security-Policy
  in `netlify.toml` enforces.
