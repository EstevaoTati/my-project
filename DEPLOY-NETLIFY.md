# Deploy MWINDA DIGITAL to Netlify

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
| `index.html`, `styles.css`, `script.js`, `i18n.js` | The site itself (FR/EN i18n) |
| `preview.html` | Self-contained single-file version (CSS+JS inlined) |
| `demo.html` | Side-by-side desktop/mobile preview viewer |
| `netlify.toml` | Build, redirects, security headers, caching |
| `_redirects` | Friendly URLs (`/preview`, `/demo`) |
| `_headers` | Per-file headers (cache-control, security) |
| `robots.txt`, `sitemap.xml` | SEO basics |

## Chat widget (os.html → Netlify Function)

The "Talk to the OS" demo chat on `os.html` calls
`netlify/functions/chat.mjs`, which proxies to the Claude API. Before it
works in production:

1. Netlify UI → *Site settings → Environment variables*: set
   `ANTHROPIC_API_KEY` (never commit it). Optional: `CHAT_MODEL`
   (defaults to `claude-opus-4-8`), `CHAT_ENABLED=false` to disable,
   `FOUNDER_KEY` to enable founder (OS kernel) mode.
   Founder mode: type `/os <FOUNDER_KEY>` in the chat to talk to the
   MWINDA OS kernel itself (higher limits, kernel system prompt);
   `/public` switches back. Without `FOUNDER_KEY` set, OS mode is off.
2. console.anthropic.com → *Plans & Billing*: set a hard monthly spend
   limit — this is the abuse backstop for the public widget.
3. Note: `package.json` exists only so Netlify bundles the function's
   `@anthropic-ai/sdk` dependency; the site itself still has no build step.
   Netlify Drop (Option A) does NOT deploy functions — use Git or CLI.

## Post-deploy checklist

- [ ] Open the Netlify URL on desktop — verify hero 3D, animations, form
- [ ] Open it on a phone — verify mobile layout
- [ ] Check `/preview` and `/demo` shortcuts
- [ ] Run a Lighthouse audit
- [ ] Set up a custom domain (e.g. `mwindagroup.com`)
