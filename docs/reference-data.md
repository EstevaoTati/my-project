# Reference data — grounding the AI Business Intelligence engine

Until now every figure in a dossier came from the model's memory. This layer
replaces the ones that can be replaced with published statistics, and, for the
ones that cannot, makes the engine say plainly what still needs checking.

## The distinction that runs through the whole design

The ten sources split into two kinds, and treating them the same would be the
central mistake.

| | **Facts** | **Portals** |
|---|---|---|
| Sources | World Bank WDI, WGI, B-READY; UNDP HDR | UNCTAD, WIPO Lex, NATLEX, UHRI, UN Treaty Collection |
| Have an API or bulk download | yes | no |
| What we do | ingest the numbers, inject them into the prompt as ground truth | name them to the model so it knows what is checkable |
| What the model is told | "these are facts, never contradict one" | "you have NOT read these; do not quote them" |

A legal portal with no API can only be scraped or guessed at. Scraping other
people's legal databases to feed a commercial product is a licensing problem
and a fragility problem at once, and guessing is worse: an invented article
number is more dangerous than an admitted gap, because it looks checked. So
the engine never claims to have read a law. It says which obligation exists,
how confident it is, and what kind of body settles it.

**The registry itself is internal and stays that way.** Which official databases
the engine consults is methodology — the part of the product that took work to
assemble — so it shapes the prompt and never crosses to the browser. No source
list is sent to the client, rendered in a dossier, or stored on a project row.
The audit log is the only place its use is recorded.

## Why not call the APIs live during a generation

Three reasons, in order of how much they would hurt:

1. **Uptime.** A stage already runs 20–120 s. Adding external calls inside that
   window puts a paying founder's dossier at the mercy of another
   organisation's availability.
2. **Reproducibility.** The same country must yield the same baseline facts
   today and next week. A dossier that silently changes because an upstream
   endpoint hiccuped is not a document anyone can take to a bank.
3. **Courtesy and rate limits.** Fetching once per refresh for every user is
   the polite pattern; fetching once per user per generation is not.

So the ingestion runs on a schedule and the engine reads a local table.

## How the refresh actually runs

**In the database, on a schedule, with no key and nothing to invoke.** Postgres
has both halves of the problem covered — `http` for the outbound request and
`pg_cron` for the timing — so `public.refresh_reference_data()` runs on the 1st
of each month at 04:00 UTC and needs no deployment, no secret and no external
trigger. Run it by hand any time with:

```sql
select * from public.refresh_reference_data();
```

It returns one row per series with a count and a note, so a partial failure is
visible rather than silent. One bad series never abandons the other sixteen.

Two alternative paths exist and are equivalent in effect:

- `scripts/fetch-reference-data.mjs` — local, and the **only** path that can
  load B-READY, which arrives as a CSV the database cannot parse.
- `supabase/functions/refresh-reference` — an edge function, for anyone who
  would rather not enable the `http` extension. It requires the service_role
  key as a bearer token; the anon key is public and this endpoint writes.

All three read the same registries, so they cannot disagree about which
countries and series are pulled. `scripts/build-edge-function.mjs` regenerates
the edge function from those registries.

### Two API details that are easy to get wrong

Both of these were found by running the refresh against the live API, not by
reading documentation:

- **The WGI codes are `GOV_WGI_<X>.SC`** (governance score, 0–100). The
  percentile-rank codes that look correct — `RL.PER.RNK` and friends — do not
  exist in the v2 indicator API, which answers *"the indicator was not found"*.
- **Use `mrnev=1`, not `mrv=1`.** `mrv` means "the most recent year", so every
  country that has not reported it yet comes back null: it filled 5 of 58
  countries for internet usage where `mrnev` filled 58. `per_page` must also
  exceed the country count for the same reason.

## Refreshing the data locally

```bash
node scripts/fetch-reference-data.mjs                    # fetch → snapshot.json
node scripts/fetch-reference-data.mjs --push             # …and upsert to Supabase
node scripts/fetch-reference-data.mjs --bready file.csv  # add B-READY scores
node scripts/fetch-reference-data.mjs --check            # report state, no network
```

- One request per indicator for **all** countries — the World Bank API accepts a
  semicolon-separated list, so it is 17 requests, not 986.
- A partial failure never merges silently: the failed series are listed, the
  previous values stay in the database, and `--check` shows what is missing.
- **An empty fetch never overwrites a good snapshot.** That guard exists because
  the failure mode it prevents — every dossier quietly losing its grounding —
  is invisible from the outside.
- `snapshot.json` is gitignored. Supabase is the runtime source; a committed
  snapshot would only invite a stale copy to be mistaken for live data.

**B-READY has no public API.** Download the country-score file from the
[data catalogue](https://datacatalog.worldbank.org/search/dataset/0066291/business-ready-b-ready),
export the sheet to CSV, and pass it with `--bready`. The parser wants a
country column (ISO3 or name), a topic column and a score column; anything else
is ignored. Countries outside the MVP's list are dropped rather than guessed at.

**HDR needs a free key** in `HDR_API_KEY`. Without it that source is skipped
entirely rather than half-loaded.

Suggested cadence: **monthly**. These series update annually at best; a weekly
job would be noise.

## Setup

1. Run migrations `0001` → `0004` in the SQL editor.
2. `select * from public.refresh_reference_data();` once, to fill the table
   immediately rather than waiting for the 1st of the month.
3. Set `SUPABASE_URL` and `SUPABASE_SERVICE_KEY` in Netlify, so the site can
   read what was loaded.

Steps 1 and 2 are what put figures in the database. **Step 3 is what lets the
site see them** — without it the engine keeps running ungrounded, which is
also exactly how it behaved before any of this: no facts block, dossier still
generated. **Reference data enriches; it never gates.**

### A caution about vintages

`mrnev` returns the most recent value a country actually reported, which is not
always recent. The DRC's inflation figure, for instance, comes back as 2.89%
for **2016** — nine years stale. That is why the year is printed beside every
number passed to the model in the facts block. A stale figure openly labelled
is usable; the same figure presented as current is not.

## What the reader sees

Nothing about this layer, by design — only better answers. Concretely:

- Figures in the analysis are the real ones for that country instead of
  recalled approximations, with the year attached where it matters.
- Each compliance item names **the kind of body** that settles it — a national
  IP office, a labour inspectorate — without naming the database behind that
  knowledge.
- The legal banner and the per-item *"confirm with"* field carry the
  protection a source list used to: the reader is still told plainly to verify
  locally before relying on anything.

An earlier version rendered a "Sources and verification" panel and a dossier
bibliography. Both were removed: publishing the registry with every dossier
handed the methodology to anyone who ran one free analysis.

## Adding a source

Add it to `data/reference/sources.json`:

- `kind: "machine"` if it has an API or a bulk download; then add its series to
  `indicators.json` and a fetcher to the script.
- `kind: "portal"` otherwise. It will be surfaced as a link and nothing more.
- `feeds` lists the stages it is relevant to, so a compliance source does not
  clutter the financial section.
- `countryUrlStatus` is deliberately conservative:
  - `verified` — the pattern is documented and stable,
  - `unverified` — believed correct, and degrades to a valid landing page,
  - `none` — only the index is offered, and the UI says *"index — filter by
    country"* so nobody is told a generic page is a country page.

**Never promote a status without opening the resulting URL.** The link supplied
for the UN Treaty Collection was that portal's own `PageNotFound` page; had it
been trusted, every dossier would have shipped a dead citation.

## Attribution and licensing

World Bank data (WDI, WGI, B-READY) is CC BY 4.0 and is attributed in the
dossier bibliography. UNDP HDR is free to use with attribution, likewise
credited. The portal sources are linked, never redistributed — which is also
the cheapest way to stay inside their terms.
