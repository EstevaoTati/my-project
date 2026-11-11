# Decision: Ship the 242Konnect design export as a static prototype at `/242konnect`

**Date:** 2026-07-27 · **Status:** In review

## Decision

Land the three-screen 242Konnect design export (Sleek project `1kNSsCfTUFD`)
in this repository as a self-contained static prototype under `242konnect/`,
rather than as a new repo or a Netlify branch deploy:

- `index.html` (accueil), `search-results.html`, `professional-profile.html`
- `images/` — the seven bundled JPEG/PNG assets
- `_redirects` gains `/242konnect` → `/242konnect/index.html`

242Konnect is a services marketplace for Pointe-Noire, Rép. du Congo: a
customer picks a category, browses verified local professionals, and opens a
profile to book. The export was three disconnected screens; this lands them as
a clickable flow.

## Changes made to the raw export

The export could not be deployed as-is against this site's headers.

1. **Remote assets localized.** Every image pointed at a Supabase
   `user-assets` bucket, and the header avatar at a personal Google account
   photo (`lh3.googleusercontent.com`). The site CSP is `img-src 'self' data:`,
   so all of them would have been blocked. The export bundles local copies;
   the pages now use those. This also removes a live dependency on a Supabase
   project unrelated to this site.
2. **Iconify inlined.** The export loaded `code.iconify.design` at runtime to
   hydrate 33 `<iconify-icon>` web components. That host is not in the CSP
   `script-src` allowlist, so every icon would have been invisible. The
   bundled SVGs are now inlined directly into the markup — no runtime fetch,
   no CSP change, no layout shift. The export's `icons/` folder is therefore
   not committed.
3. **Unused fonts dropped.** Playfair Display and JetBrains Mono were loaded
   but never applied to any element. Removed two render-blocking requests;
   the `--font-serif` / `--font-mono` theme variables are kept intact.
4. **Navigation wired.** Screens were disconnected. Category chips and the
   search form now reach the results screen, result cards and the home
   "Top Professionnels" cards reach the profile, and back buttons are real
   links rather than `history.back()` (which dead-ends on a direct load).
   Cards became anchors, so the nested "Réserver" button became a `<span>` —
   an interactive element inside an anchor is invalid and swallows the tap.
5. **Mobile/a11y fixes.** `viewport-fit=cover` plus a real `.pb-safe` rule
   (the export used the class but never defined it, so the bottom nav sat
   under the home indicator), `lang="fr"`, per-page titles and descriptions,
   `aria-label`s on icon-only controls, and `aria-hidden` on decorative SVGs.

## Trade-off accepted: Tailwind still loads from a CDN

The pages compile Tailwind in the browser via
`cdn.jsdelivr.net/npm/@tailwindcss/browser@4`. That is a ~400 KB runtime
compiler with a flash of unstyled content on every load, and it makes the
prototype unusable offline or on any network blocking jsdelivr.

It is kept because this repo's standing constraint is "plain HTML/CSS/JS — no
build step", jsdelivr is already in the CSP `script-src` allowlist, and
keeping the export's own styling block means a re-export from Sleek can be
re-imported by re-running the same transform.

**If this graduates from prototype to product, precompile it.** Running the
Tailwind CLI once and committing a static `242konnect/styles.css` removes the
CDN dependency, the FOUC, and the runtime cost, at the price of a build step.

## Deliberate deviations from `CLAUDE.md`

- **Not wired into `i18n.js`.** The repo rule is that user-facing strings stay
  translatable. This prototype is intentionally French-only for the Congolese
  market and is a different product from the Mwinda marketing site; sharing
  the marketing site's translation table would couple them for no benefit.
  Revisit if 242Konnect needs Lingala/English.
- **Not added to `sitemap.xml`.** It is an internal prototype, not something
  to hand to search engines yet.

## Known gaps

- All data is static. Filters, favourites, notifications, and the bottom-nav
  destinations (Missions, Messages, Profil, "+") are non-functional.
- The results screen always lists the same two plumbers; the requested
  category is only echoed in the heading.
- The second portfolio tile on the profile screen is still the design tool's
  grey placeholder (`images/landscape.png`) — it needs a real asset before
  this is shown to anyone outside the team.
