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

- **Wedding information first.** Welcome photo and names, the full date
  (Saturday, March 13, 2027 · Sumner, Washington), a countdown, ceremony and
  reception cards with calendar and directions, the program, a golden-envelope
  invitation, gifts, FAQ, and a closing photo. Two photographs in total, chosen
  by the couple.
- **RSVP, two ways.** An open form on the page (name, single or couple,
  email, attending, message): anyone with the site link can reply, and
  replying again with the same email updates the earlier answer. Guests with a
  personal link or QR code get a prefilled form capped at their seats.
  Open replies appear in the dashboard under the group "Online RSVP".
- **Gifts:** the couple's wording, asking for a monetary contribution because
  they relocate abroad after the wedding. Banking details stay off the site
  until the couple enters them in the dashboard.
- **Dashboard:** live counts, guest list with search and filters, CSV
  import/export, share by WhatsApp / SMS / email / copied link / QR, optional
  automatic email (Resend), content editing in both languages, photo upload
  and scene assignment, seating planner.
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
node scripts/test.mjs --e2e          # 29 checks: unit, API, browser (phone + desktop)
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
