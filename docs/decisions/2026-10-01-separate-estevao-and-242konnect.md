# Separate the Estevao Tati site from 242Konnect

Date: 2026-10-01 · Requested by the founder: "242 Konnect is not in Estevao
Tati web. Fix the package and separate the 242 konnect from Estevao."

## What was wrong

The landing page's `netlify.toml` published the repository root (`publish =
"."`). Every 242Konnect folder was therefore served under the Estevao Tati
domain — the app build (`/242konnect-web`), the old prototype (`/242konnect`),
the API source, the database migrations, even the zip — and the landing
page's config carried 242Konnect routes, cache rules and a Supabase CSP
exception.

## Decision

- The landing page moves to `estevao-tati-site/`; the root `netlify.toml`
  publishes that folder only and contains no 242Konnect rule.
- 242Konnect is published only from `242konnect-web/` on its own Netlify site.
- Each product has its own drag-and-drop package, and each package script
  refuses to finish if the other product's content is inside it.
- `242konnect-app/tools/verify-csp.js` asserts the separation.
- The old `242konnect/` prototype is no longer published anywhere.

## Consequence

Links of the form `<landing-site>/242konnect-web` stop working after the next
landing deploy. 242Konnect is reached through its own site only.

Not done (founder's call): moving 242Konnect into its own GitHub repository.
The deployments are already independent; a separate repo would also separate
history and access.
