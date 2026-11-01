# LES ÉLITES PUBLISHING HOUSE — The House of Knowledge

Cinematic, scroll-driven site for the publishing house. Static HTML/CSS/JS,
one Netlify function, Supabase for submissions. **No build step on the host.**

## What is here

| Path | Role |
|---|---|
| `index.html` | The experience: 5 scenes (Parvis → Hall → Bibliothèque → Atelier → Observatoire) + contact |
| `experience.js` | Scroll camera: reads native scroll, drives video time, cross-fades, reveals, `--p` |
| `ui.js` | Menu, classic/motion toggles, CSS-3D shelf, book/author/collection panels (`<dialog>`) |
| `forms.js` | Contact + manuscript forms (3-step signed upload) |
| `i18n.js` | FR (source, default) / EN |
| `data/catalog.js` | **Single source of truth** for books, authors, collections, services |
| `catalogue.html`, `livres/*`, `auteurs/*`, `sitemap.xml` | **Generated** by `scripts/build-pages.mjs` — do not hand-edit |
| `manuscrit.html`, `confidentialite.html` | Manuscript portal, privacy notice |
| `netlify/functions/submit.mjs` | `/api/submit` — validation, rate limit, signed upload, notification |
| `supabase/migrations/0001_init.sql` | Tables (RLS on, no policies), private bucket, status audit trigger |
| `scripts/prepare-media.sh` | Downloads the Higgsfield clips and encodes them as seamless boomerang loops |
| `scripts/smoke-test.mjs` | Playwright test of the whole experience (run before every deploy) |
| `docs/higgsfield-production.md` | Shot list, prompts, job ids, continuity rules |

## Commands

```bash
node scripts/build-pages.mjs          # after editing data/catalog.js
node scripts/build-pages.mjs --check  # fails if generated pages are stale
bash scripts/prepare-media.sh         # fetch + encode the 5 scene clips → media/
bash scripts/package-netlify.sh       # → ../les-elites-netlify.zip for Netlify Drop
node scripts/smoke-test.mjs           # browser test (SHOTS=dir for screenshots,
                                      #   MEDIA_DIR=dir to test with real clips)
python3 -m http.server 8080           # local preview (forms answer 501 locally)
```

## Rules this codebase keeps

1. **Nothing invented.** Every fact in `data/catalog.js` is read off an official
   cover or poster. Unknown = `null`, and the UI hides it. No price, no buy
   link, no bio, no service is shown until the house confirms it.
2. **No fake features.** No cart without a payment provider; "Demander ce
   livre" goes to the real contact form. A form whose backend is not configured
   says so (HTTP 501) instead of faking success.
3. **The experience is never required.** "Passer l'expérience" shows the same
   content as a normal page. Reduced motion, Save-Data and no-JS all get the
   full content. Each scene degrades video → poster → CSS-painted architecture,
   so a missing file is never a black screen.
4. **No scroll hijacking.** The page scrolls natively; JS only reads it.
5. **The browser never holds a Supabase credential.** Manuscripts go to a
   private bucket via a single-use signed URL issued by the function.

## Deploy (own Netlify site)

1. New Netlify site from this repo, **base directory `clients/les-elites`**
   (or move this folder to its own repo — it is self-contained).
2. Supabase: run `supabase/migrations/0001_init.sql`. Enable MFA on every team
   account (Studio is the admin for v1 — see below).
3. Netlify env vars: `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `IP_SALT` (random).
   Optional e-mail alerts: `RESEND_API_KEY`, `NOTIFY_TO`, `NOTIFY_FROM`.
4. In `netlify.toml`, replace `https://*.supabase.co` in `connect-src` with the
   exact project host.
5. `bash scripts/prepare-media.sh`, commit `media/`, deploy, run the smoke test
   against the preview.

## Administration (v1)

Supabase Studio, behind MFA: `manuscript_submissions` (change `status`:
received → in_review → more_info → decision_sent; every change is logged to
`submission_events` by trigger), `contact_messages`, the private `manuscripts`
bucket. Catalogue edits: `data/catalog.js` + `build-pages.mjs` (a pull request
is the approval step and the history). A custom admin UI is deliberately
deferred — see `docs/decisions/2026-10-31-les-elites-architecture.md` in the
parent repo.

## Open items the house must supply

- Contact e-mail / WhatsApp / address, legal entity for the privacy notice
- Sales channel per book (URL + price), formats, descriptions
- Author bios and photos (only Lessa Annette Kuedituka has a photo, from the launch poster)
- A flat front cover for *Biblical Business and Entrepreneurship Model* (current image is a lifestyle photo)
- Which editorial services are actually sold (only "Publication" is confirmed)
- Science-in-our-languages programme: titles and availability per language
- Access to https://leselitespublishinghouse.com for the content audit (blocked from the build sandbox)
