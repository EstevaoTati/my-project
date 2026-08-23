# Supabase — setup and data model

Platform data (AI Business Intelligence projects, contact leads, product
metrics) is stored in Supabase. This is the 15-minute setup.

## 1. Create the project

1. https://supabase.com → **New project**. Pick the region closest to your
   users — for the DRC, `eu-central-1` (Frankfurt) is usually the fastest.
2. Save the database password somewhere safe. You will not need it for the
   site, but you will need it for the CLI or the SQL editor later.

## 2. Create the tables

Supabase dashboard → **SQL Editor** → **New query** → paste the whole of
`supabase/migrations/0001_init.sql` → **Run**. Then do the same with
`0002_retention.sql`, `0003_reference_data.sql` and
`0004_reference_refresh.sql`, in that order.

`0004` also schedules both recurring jobs with `pg_cron` — the monthly
reference refresh and the weekly retention purge — so nothing needs to be
scheduled by hand any more.

That creates `projects`, `leads`, `events`, the `kpi_overview` view, the
`updated_at` trigger, the reference-data tables, and — importantly — enables
Row Level Security with **no policies** on every table.

`0003` also adds `sources` and `grounding` to `projects`: a dossier records
which references it was written against, so a later data refresh cannot
retroactively change what a finished document claims to cite.

## 3. Wire it to the site

Supabase dashboard → **Project Settings → API**. Copy:

| Supabase field | Netlify environment variable |
|---|---|
| Project URL | `SUPABASE_URL` |
| `service_role` secret | `SUPABASE_SERVICE_KEY` |

Netlify → *Site configuration → Environment variables* → add both, "Same value
for all deploy contexts".

**The `service_role` key bypasses every security rule in the database.** It
belongs only in Netlify's environment variables — never in the repository,
never in a page, never in a chat. The site never sends it to a browser.

You do **not** need the `anon` key. The browser never talks to Supabase.

## 4. Check it works

Open `/bi`, type an idea, wait two seconds. The line under the button should
change from *"Saved in this browser"* to *"Saved to your MWINDA account"*.
Then in Supabase → **Table Editor → projects**, your row is there.

If it still says "Saved in this browser", the variables are missing or
mistyped — the site is designed to keep working locally in that case rather
than break.

---

## Security model

The important decisions, and why:

**The browser holds no Supabase credential.** Every read and write goes
through a Netlify function (`project.mjs`, `lead.mjs`) that holds the
`service_role` key server-side. There is no anon key in the page to leak.

**RLS is on, with no policies.** `service_role` bypasses RLS; `anon` and
`authenticated` therefore get nothing. If a key ever leaked, or someone
pointed a Supabase client at the project, they would read zero rows. Deny by
default.

**Projects are owned by a capability token, not an account.** This MVP has no
login. On first save, the server issues a 32-byte token and stores only its
SHA-256. A project is returned only when the request carries both the
unguessable uuid and the matching token. Consequences, stated plainly:

- A database dump does **not** hand over API access — the tokens are not in it.
- The "Copy access link" button produces `…/bi.html#p=<id>.<token>`. That link
  **is** the credential: anyone holding it can open and edit that project.
  Treat it like a password. The fragment is never sent to the server by the
  browser, so it does not appear in server logs.
- Lose the token and the project is unreachable through the API. There is no
  recovery flow, by design of a login-less MVP.

**Personal data.** `leads` holds names, emails and messages. The contact form
says so next to the submit button. `0002_retention.sql` makes the promise
real: `purge_expired()` deletes leads older than 18 months and events older
than 12, and `erase_lead('someone@example.com')` handles an erasure request
without hand-written SQL. `0004` schedules the purge weekly with `pg_cron`, so
the promise is now kept automatically rather than depending on someone
remembering.

**`events` holds no personal data** — an event name, an optional project id,
and a small JSON blob. No IP addresses, no cross-site tracking.

**`reference_indicators` holds public statistics**, not user data — World Bank
and UNDP figures per country. It is still service_role-only, because the
browser has no Supabase credential and adding one for "harmless" data would
undo that. Refreshed by `scripts/fetch-reference-data.mjs`; see
`docs/reference-data.md`.

---

## What is deliberately NOT in Supabase

**Chat conversations.** The OS page states publicly: *"Conversations are not
stored by this site."* Storing them would make that statement false. If you
ever want them stored, the sentence has to change first, and visitors should
be told before the change, not after.

**Monday briefs and decision records.** These stay as markdown in the
repository. That is not an oversight — it is the MWINDA OS memory model in
`CLAUDE.md`: decisions are versioned, reviewable in a pull request, and
survive any database. Moving them into Supabase would break the Monday routine
(which opens a PR) and lose the audit trail.

---

## Cost

The Supabase free tier covers this comfortably: these tables are small (a full
dossier is 40–80 KB of JSON) and traffic is low. The limit to watch on the free
tier is **project pausing after 7 days of inactivity** — if the site goes quiet
for a week, the database sleeps and the first request afterwards fails. The
site degrades to local storage rather than breaking, but plan for the paid tier
once you have real users.

## Operations

- **Kill switch:** remove `SUPABASE_URL` from Netlify. Everything falls back to
  browser storage within a minute.
- **KPIs:** the `kpi_overview` view answers "is this being used?" — projects
  created, completion rate, dossiers exported, leads. Query it in the SQL
  editor, or via the founder-gated `stats` action on `/.netlify/functions/project`.
- **Backups:** Supabase takes daily backups on paid plans. On free, export
  periodically from the dashboard.
