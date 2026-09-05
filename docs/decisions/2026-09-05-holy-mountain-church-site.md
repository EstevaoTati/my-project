# Holy Mountain Washington Church site lives at /holy-mountain/

**Date:** 2026-09-05 · **Status:** accepted

## Context

The founder asked for a church website for Holy Mountain Washington Church
(CEMMS · MSW), including an animated logo video generated on Higgsfield. This
repository already serves the Mwinda Digital landing page from its root.

## Decision

Build the church site as a self-contained folder, `holy-mountain/`, deployed
by the same Netlify site at `/holy-mountain/` with `/church` as a short link.
The Mwinda landing page at `/` is untouched.

## Why

- A client site and the studio's own landing page should not share a document.
  Separate folders mean either can be rewritten without regression risk.
- Netlify publishes the repo root, so a folder is live with no extra config,
  no second site and no extra cost.
- If the church later takes its own domain, the folder moves to its own repo
  or gets a domain-level redirect. Nothing has to be untangled first.

## Consequences

- Two independent sites in one repo. Shared: `netlify.toml`, `sitemap.xml`,
  `robots.txt`. Everything else is scoped to its folder.
- The church site self-hosts its own fonts (Anton + Inter) rather than reusing
  the Mwinda faces (Chakra Petch + JetBrains Mono) — a church and a technology
  studio should not read as the same brand.
- Content the church must own (service times, address, giving details, social
  URLs) is isolated in one config object in `assets/js/site.js`, so updates
  never require touching markup. An amber draft banner stays visible until
  those values are confirmed and `SITE.draft` is set to `false`.

## Follow-ups

- Confirm service times, address and social profile URLs, then set
  `SITE.draft = false`.
- Enable form notifications in Netlify (*Forms → contact*).
- Consider a dedicated domain for the church and a `sermons` page once there
  is a back catalogue worth indexing.
