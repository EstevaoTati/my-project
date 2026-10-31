# LES ÉLITES — "House of Knowledge" site: architecture choices

Date: 2026-10-31 · Code: `clients/les-elites/`

## Decision

Build the Les Élites platform on the stack MWINDA already runs (static
HTML/CSS/JS + Netlify functions + Supabase), **not** the Next.js / React Three
Fiber / custom CMS stack the brief suggested. Ship it as a self-contained
folder that deploys as its **own** Netlify site. `/clients/*` is 404'd on the
MWINDA domain.

## Why

- **Cinematic depth comes from footage, not WebGL.** Photoreal Higgsfield
  clips scrubbed by scroll give real camera movement through a believable
  building. A real-time Three.js building at that fidelity is weeks of 3D work
  and heavy on phones. Interactive objects (the bookshelf, the manuscript
  turning into a book) use CSS 3D: real 3D transforms, keyboard-accessible
  buttons, no GPU-context failures, so no WebGL fallback is needed.
- **Native scroll, no GSAP.** The engine only reads `scrollY`, so wheel,
  touch, anchors, fast flicks and scrolling back all work. Removing GSAP also
  removes the "GSAP blocked → fallback path hides a bug" trap recorded in
  CLAUDE.md.
- **Admin = Supabase Studio with MFA for v1.** A custom admin with roles, MFA
  and an audit trail is a project in itself. Studio already gives the team
  auth, MFA and table editing; a trigger logs every status change. The
  catalogue is versioned data (`data/catalog.js` → generated static pages)
  edited by pull request. Build a custom admin only when non-technical staff
  edit daily.
- **Manuscripts bypass the function.** Netlify's ~6 MB sync body limit is
  below a 20 MB manuscript. The function issues a single-use signed upload URL
  to a private bucket; the browser holds no credential.
- **Nothing invented.** The live site could not be fetched from the sandbox,
  so the catalogue holds only what official covers and posters show. Unknown
  facts are `null` and hidden: no prices, buy links, bios or unconfirmed services.

## Trade-offs accepted

- Scroll-scrubbed video needs re-encoding (keyframe every 6 frames) and about
  2–5 MB per scene. Only the current and next scene load.
- Shot-to-shot continuity is a cross-fade "through the doorway", not one
  continuous take. A truly seamless take needs bridge clips (start + end frame).
- The SEO pages are generated and committed. `build-pages.mjs --check` guards
  against drift.

## Revisit when

- The house sells direct (add Stripe Checkout: hosted, no card data on our side).
- Editors outside the founder's team need to change content weekly (custom admin).
- The domain moves here (update `site.origin` and canonical/hreflang links).
