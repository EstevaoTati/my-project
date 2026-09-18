# Holy Mountain Washington Church — website

Static site for **Holy Mountain Washington Church** / *Communauté Évangélique
Missionnaire La Montagne Sainte* (CEMMS · MSW). Plain HTML, CSS and JavaScript.
No build step, no framework, no external runtime dependency.

Deployed with the rest of the repo on Netlify. Live path: `/holy-mountain/`
(the short link `/church` redirects there).

```
holy-mountain/
├── index.html              the whole page
├── thanks/                 form confirmation page (noindex)
├── package.sh              builds the standalone Netlify package
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

**An empty value is hidden, not shown blank.** The page never displays a
placeholder to a visitor: while `mapsUrl` is empty the "Get directions" button
is not rendered, and while the social URLs are empty the icons, the
"Follow the church" heading, the "Watch on YouTube" button and the footer's
YouTube link are all absent. Fill a value in and its element reappears by
itself. This is why there is no "draft mode" banner: nothing on the page is
pretending to be finished.

- [x] **Service time** — `SITE.times.sunday`, confirmed as Sunday 11:00 AM to
      1:00 PM. Only the Sunday service is listed. Nothing else on the page
      claims a weekly programme, so add a card to the visit section (and an
      entry to `SITE.times`) only for a gathering that actually runs.
- [ ] **Address** — `SITE.address` currently says just "Tacoma, Washington",
      which is true but not a street address. Add the full one, and point
      `SITE.mapsUrl` at the venue to bring back the "Get directions" button.
      The church is in **Tacoma, Washington**, not Washington, D.C.
- [ ] **Canonical URL** — `index.html` carries no `<link rel="canonical">`,
      because the church's domain is not settled. Add one pointing at the real
      domain once it is, so search engines index a single address.
- [x] **Giving** — `SITE.giving`, confirmed: Cash App `$holymountainchurch1`
      and Zelle `(206) 610-8770`.
- [ ] **Social links** — `SITE.social`. All four are empty, so nothing social
      is shown at all. Add the church's own profile URLs (Instagram, Facebook,
      YouTube, TikTok) and the icons, the follow heading and the
      "Watch on YouTube" button appear.
- [ ] **Leadership bios** — the two paragraphs in the leadership section are
      written from the role, not from anyone's own history, precisely so that
      nothing was invented. Replace them with the pastor's own words. They are
      in `index.html` (`data-i18n="lead.d1"` and `lead.d2`) with the French in
      the `FR` dictionary in `assets/js/site.js`.

## Deploying it on its own

The site lives at `/holy-mountain/` here, but it can also stand alone on its own
Netlify site and its own domain. `./package.sh` builds
`holy-mountain-netlify.zip` for that: the same files, with the redirect and
header rules rewritten from `/holy-mountain/*` to `/*`, since a dropped site is
the root of its own domain and the prefixed rules would match nothing.

Drag the zip onto <https://app.netlify.com/drop>. `DEPLOY.md` inside it covers
what to do after the first deploy. **Regenerate the package rather than editing
it** — a snapshot that is edited by hand drifts from the site it came from.

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
| `Strict-Transport-Security` | Once the site has been reached over HTTPS, the browser refuses plain HTTP for a year. |

### One directive that is deliberately absent

The policy does **not** contain `upgrade-insecure-requests`, and must not be
given it back. That directive rewrites every subresource request to `https://`.
On a custom domain that is still served over plain HTTP — the window between
pointing the DNS at Netlify and Netlify issuing the certificate — every
stylesheet, script, font and image is rewritten to a URL that cannot be served,
fails, and the visitor gets naked HTML: serif text, blue underlined links, no
images, and both navigation menus visible at once because the CSS that hides
the mobile drawer never arrived. That is exactly what happened on
`holymountainch.com`.

It buys nothing here in exchange. Every asset URL in the page is relative, so
it already follows the document's own scheme; there is never a mixed-content
request for the directive to upgrade. The real fix for plain HTTP is the
certificate and **Force HTTPS** in Netlify's *Domain management → HTTPS*, which
`Strict-Transport-Security` then locks in — not a directive that breaks the
page while you wait for it.

**One rule keeps that policy working.** It allows no inline script and no
inline style, which is what makes it worth having. So this folder contains
neither: every rule lives in `assets/css/site.css` and every line of JavaScript
in `assets/js/site.js`. **Adding one `style="..."` attribute or one inline
`<script>` would be silently blocked in production** — not styled wrongly,
simply gone.

The page also carries no JSON-LD structured data, for the same reason. The
site-wide policy on `/*` lists only the Mwinda pages' own script hashes, and a
second policy cannot widen the first: a browser enforces every policy it
receives, so an inline block allowed by ours and not by theirs is blocked. If
the church later gets its own domain, or its hash is added to
`scripts/update-csp.mjs`, the structured data can come back.

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
watermark behind the vision and contact sections. It runs continuously and
there is no pause control on the page: a clip that stalls or ends starts again
on its own, and one that a browser refuses to autoplay is retried on the
visitor's first interaction.

Only the clip you are looking at is actually decoding. The others are paused
off screen, which the viewer never sees but their battery does, and the two
background copies are not downloaded until they scroll into view. On a phone,
or when the browser reports Save-Data, they are never downloaded at all and
only the hero clip runs.

**Reduced motion is the one way out, so do not weaken it.** With the pause
control gone, a visitor whose system asks for less motion is relying on that
guard alone: nothing autoplays for them, the background clips are hidden by
CSS, and they see the still poster frame. Some people need that — motion can
trigger nausea or migraine, and for a few it triggers seizures. If a pause
button is ever wanted back, it belongs in the corner of the hero.

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
  This is the only mechanism they have, since the page carries no pause control.
- Nothing loads from a third-party domain — fonts, scripts and images are all
  served from our own origin, which is what the site's Content-Security-Policy
  in `netlify.toml` enforces.
