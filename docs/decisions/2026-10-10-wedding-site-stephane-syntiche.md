# Wedding site for Stephane & Syntiche — built on the house stack, not Next.js

**Date:** 2026-10-10 · **Status:** built, awaiting deployment

## Context

Brief: an "ultra-premium" cinematic wedding site (March 13, 2027, Sumner WA)
with personal invitations, RSVP, gifts, gallery, guestbook, FAQ, dashboard,
QR check-in, seating and messaging. The brief prescribed Next.js +
TypeScript + Tailwind + shadcn + Supabase Auth + Three.js + Vercel.

## Decision

Built in `weddings/stephane-syntiche/` as its **own Netlify site** on the
stack this repo already runs in production: static HTML/CSS/JS, Netlify
Functions, Supabase via PostgREST with the service key server-side only,
GSAP self-hosted.

| Brief asked for | Built instead | Why |
|---|---|---|
| Next.js / React / Tailwind / shadcn | Vanilla, no build | One page and ~150 households. A framework adds a build, a dependency tree to patch until 2027, and nothing guests would see. |
| Supabase Auth + RBAC | `ADMIN_KEY` + `STAFF_KEY` (two roles), lockout, audit | Two to four organisers. Accounts, invites and password resets cost more than they protect here. Swap in Supabase Auth if a third party ever manages it. |
| Three.js / WebGL | One 2D canvas (stars, gold particles, bursts) + CSS ornaments | Same effect at a fraction of the weight. Guests open this on their phones, often inside WhatsApp's in-app browser. |
| Vercel | Netlify (second site, same repo) | Already wired, with env vars, security patterns and know-how. |
| Automated WhatsApp/SMS | Prefilled share links; Resend email optional | The official WhatsApp API needs a verified business account and templates. For this guest count, the couple's own phone is faster and more personal. |

## Non-negotiables kept

- Real photos only. Seven uploads, web-optimised, faces preserved, no stock and no generation.
- Nothing invented. Venue, times, deadline, story, program and gift links are `null` and render as "to be announced".
- Guest privacy: a signed link opens exactly one invitation. No guest list anywhere public. Purge function for after the wedding.
- Accessible without motion: reduced-motion and GSAP-failure modes are tested to show every chapter.

## Reuse

The pattern (signed invitation links, RSVP with seat caps, door check-in,
bilingual content model, scene-per-chapter motion) is product-shaped. If
Mwinda Digital sells wedding or event sites, this folder is the template:
copy it, change `content.json` and the photos, and deploy a new site.

## Open items for the couple

Venues, addresses, times, RSVP deadline, dress code, story text, program,
gift links, contact person, photographer credit, guest list. Confirm also
that "Stephane" is the groom and "Syntiche" the bride: the "Two Souls" labels
assume it.
