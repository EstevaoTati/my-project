# Reference data — grounding the AI Business Intelligence engine

Until now every figure in a dossier came from the model's memory. This layer
replaces the ones that can be replaced with published statistics, and, for the
ones that cannot, tells the founder exactly where to check.

## The distinction that runs through the whole design

The ten sources split into two kinds, and treating them the same would be the
central mistake.

| | **Facts** | **Links** |
|---|---|---|
| Sources | World Bank WDI, WGI, B-READY; UNDP HDR | UNCTAD, WIPO Lex, NATLEX, UHRI, UN Treaty Collection |
| Have an API or bulk download | yes | no |
| What we do | ingest the numbers, inject them into the prompt as ground truth | attach the URL to the dossier |
| What the model is told | "these are facts, never contradict one" | "you have NOT read these; do not quote them" |

A legal portal with no API can only be scraped or guessed at. Scraping other
people's legal databases to feed a commercial product is a licensing problem
and a fragility problem at once, and guessing is worse: an invented article
number is more dangerous than an admitted gap, because it looks checked. So
the engine never claims to have read a law. It says which obligation exists,
how confident it is, and where the founder can settle it.

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

## Refreshing the data

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

1. Run `supabase/migrations/0003_reference_data.sql` in the SQL editor.
2. Run the script with `--push` once to fill the table.
3. That is all. `bi.mjs` picks it up on the next generation.

Until step 2 the engine behaves exactly as it did before this layer existed:
no facts block, links still attached, dossier still generated. **Reference data
enriches; it never gates.**

## What the founder sees

- Each grounded section ends with *"This section was written with N verified
  indicators for <country> (2022–2023) supplied to the engine as fact."*
- When no data exists for a country, the same panel says so in a warning colour
  instead — an honest absence rather than a silent one.
- The dossier carries one deduplicated bibliography, with full URLs printed so
  they survive being read on paper.

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
