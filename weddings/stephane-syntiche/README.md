# Stephane & Syntiche — The Beginning of Forever

Wedding website, digital invitations and guest management for
**March 13, 2027 · Sumner, Washington**. Built by Mwinda Digital.

| Where | What |
|---|---|
| `/` | The cinematic guest site (EN/FR) |
| `/?invite=CODE.SIG` | A guest's personal invitation (link or QR code) |
| `/admin` | Private dashboard — `ADMIN_KEY` |
| `/checkin` | Door check-in on the day — `STAFF_KEY` |

## What's in it

- **Eleven scenes**, each with its own motion technique: an arch-framed photo
  that opens to full screen; two halves of one photograph drifting together;
  five story milestones (curtain, blur-to-focus, slide, iris, Ken Burns); a
  promise that dissolves into light; branches parting around a crystal sphere
  as the date rises and gold falls; a live countdown; a self-drawing program
  line; a golden envelope that opens on arrival; a finale that darkens into stars.
- **Personal invitations.** Every invitation has a signed link and QR code. The
  guest is greeted by name, in their language, and their RSVP form is
  prefilled with their party and capped at the seats they were given.
- **RSVP** with dietary needs and optional meal choices, a deadline, and
  updates (both switchable).
- **Dashboard:** live counts, guest list with search and filters, CSV
  import/export, share by WhatsApp / SMS / email / copied link / QR, optional
  automatic email (Resend), content editing in both languages, photo upload
  and scene assignment, guestbook moderation, seating planner.
- **Door app:** scan the QR code (or type it), confirm the count, done.
  Duplicates are refused; only an admin can undo.

## Nothing is invented

Only the names, date and city are confirmed. Venues, times, dress code, RSVP
deadline, story text, program, gift links and contacts are `null` in
`content.json`. The site shows **"to be announced"** until the couple fills
them in from the dashboard (*Content* tab → **Save & publish**).

## Run it locally

```bash
node scripts/dev-server.mjs          # http://localhost:8787 — fake database, dev keys printed
node scripts/test.mjs --e2e          # 26 checks: unit, API, browser (phone + desktop)
```

No build step and no npm install: the functions use only Node built-ins, and
GSAP, ScrollTrigger, the QR generator and the QR scanner are vendored in
`assets/vendor/`.

## Deploy

See [`docs/SETUP.md`](docs/SETUP.md): one Supabase migration, one Netlify
site, five environment variables.

## Files

```
index.html  wedding.css  i18n.js  app.js  motion.js  sky.js   guest site
admin.html  admin.css    admin.js                            dashboard
checkin.html checkin.css checkin.js                          door app
content.json                                                 default content (all unknowns null)
netlify/functions/   content · invite · guestbook · admin · checkin · _lib
supabase/migrations/0001_wedding.sql
scripts/dev-server.mjs  scripts/test.mjs
assets/photos/  (web-optimised WebP, 720 + 1400 px)   assets/vendor/
```
