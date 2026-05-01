# Deploy MWINDA GROUP to Netlify

This site is a **static site with no build step** — it is ready to deploy as-is.

## Option A — Netlify Drop (fastest, ~30 seconds)

1. Download `mwinda-netlify.zip` from the repo (or the project folder).
2. Open https://app.netlify.com/drop
3. **Drag and drop** the zip (or the unzipped folder) onto the page.
4. Netlify gives you a URL like `https://random-name.netlify.app` — your site is live.
5. (Optional) Click *Site settings → Change site name* to set a custom subdomain.
6. (Optional) Add a custom domain under *Domain management*.

## Option B — Connect Git (auto-deploy on push)

1. Go to https://app.netlify.com → **Add new site → Import an existing project**.
2. Connect to GitHub and select `EstevaoTati/my-project`.
3. Configuration (auto-detected from `netlify.toml`):
   - **Build command:** *(empty)*
   - **Publish directory:** `.`
4. Click **Deploy site**. Every push to `main` will redeploy automatically.

## Option C — Netlify CLI

```bash
npm i -g netlify-cli
netlify login
netlify deploy --prod --dir=.
```

## Files included

| File | Purpose |
|------|---------|
| `index.html`, `styles.css`, `script.js` | The site itself |
| `preview.html` | Self-contained single-file version (CSS+JS inlined) |
| `demo.html` | Side-by-side desktop/mobile preview viewer |
| `netlify.toml` | Build, redirects, security headers, caching |
| `_redirects` | Friendly URLs (`/preview`, `/demo`) |
| `_headers` | Per-file headers (cache-control, security) |
| `robots.txt`, `sitemap.xml` | SEO basics |

## Post-deploy checklist

- [ ] Open the Netlify URL on desktop — verify hero 3D, animations, form
- [ ] Open it on a phone — verify mobile layout
- [ ] Check `/preview` and `/demo` shortcuts
- [ ] Run a Lighthouse audit
- [ ] Set up a custom domain (e.g. `mwindagroup.com`)
