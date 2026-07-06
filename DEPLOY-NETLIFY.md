# Deploy HGIM Website to Netlify

This folder is a complete, ready-to-deploy static site for
**Holy Ghost Impact Ministries** — no build step required.

## Option A — Drag & drop (fastest, ~1 minute)

1. Go to https://app.netlify.com/drop
2. Drag the **entire unzipped folder** (the one containing `index.html`) onto the page
3. Done — Netlify gives you a live URL immediately

## Option B — Connect the GitHub repository

1. In Netlify: **Add new site → Import an existing project → GitHub**
2. Pick this repository and branch
3. Build command: *(leave empty)* · Publish directory: `.`
4. Deploy

## Custom domain (holyghostimpactministries.com)

1. Netlify → Site settings → **Domain management → Add custom domain**
2. Point the domain's DNS to Netlify (they show you the exact records)
3. HTTPS is provisioned automatically

## What's included

| File | Purpose |
|---|---|
| `index.html` | The complete single-page website |
| `styles.css` | Design system (black & gold, animations) |
| `script.js` | Motion engine (scroll orbit, counters, cursor) |
| `assets/` | Logo, congregation photos, event flyers (optimized) |
| `netlify.toml` | Headers, caching, security config |
| `_headers`, `_redirects` | Netlify edge config |
| `robots.txt`, `sitemap.xml` | SEO basics |

## Notes

- Three decorative backgrounds load from the Higgsfield CDN
  (`d8j0ntlcm91z4.cloudfront.net`) with gradient fallbacks if offline.
  The `netlify.toml` Content-Security-Policy already allows that host.
- To update event flyers later, replace the images in `assets/`
  (`flyer-prayer-retreat.jpg`, `flyer-baptism.jpg`, `flyer-bible-study.jpg`)
  keeping the same file names — no code changes needed.
- The contact form is client-side only. To receive submissions by email,
  add `name="contact" netlify` attributes to the `<form>` tag
  (Netlify Forms) or connect a service like Formspree.
