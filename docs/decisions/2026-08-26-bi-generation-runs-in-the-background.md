# The BI engine generates in a background function, not a streamed response

**Date:** 2026-08-26
**Status:** shipped
**Supersedes** the streaming rationale in
`docs/decisions/2026-08-22-ai-business-intelligence.md`
**Scope:** `netlify/functions/bi.mjs`, `bi-run-background.mjs`, `bi-status.mjs`,
`_jobs.mjs`, `_bi_stages.mjs`, `bi.js`, `package.json`

## The bug

Every analysis failed with **"no result received — please retry"**.

That message comes from `bi.js`: it is what the client says when the response
stream ends having delivered neither a `result` line nor an `error` line. Every
path in the old `bi.mjs` sent one or the other — truncation, incomplete tool
output, rate limits, an unavailable engine, all covered. A stream ending with
*neither* has only one explanation: **the invocation was killed.**

And it had to be. The engine's own comment said it:

> a stage takes 30-90s, far beyond the synchronous response window

The conclusion drawn from that in August was wrong. Streaming **holds a
connection open; it does not extend a function's execution limit.** A
synchronous Netlify function is bounded whatever it is writing to the socket.
When the platform stopped the invocation, bytes had already been sent, so the
browser did not see an HTTP error — it saw a stream that simply stopped.

Which means the BI engine **had never worked in production**, on any stage, for
any founder. The rest of the MVP's reported symptoms follow from it: no stage
ever completed, so the dossier was always empty, so "Download PDF" always said
there was nothing to export.

## The fix

Netlify runs any function whose name ends in `-background` asynchronously: the
caller gets `202` at once and the function keeps running for up to 15 minutes.
That is the only shape on this platform that fits 20-120 seconds of work.

```
browser ──POST──▶ bi.mjs (dispatcher)      validates, rate limits, budgets
                    │                       mints a job id, returns 202 in ms
                    └──invoke──▶ bi-run-background.mjs
                                   │ runs the model, up to 15 min
                                   └─writes──▶ job record (Netlify Blobs)
browser ──GET (poll every 2s)──▶ bi-status.mjs ──reads──▶ job record
```

- **`bi.mjs`** keeps every guard it had — origin, global and per-IP rate limits,
  token budget, body size, founder key, idea length — and adds one: it refuses
  up front if the job store is unreachable, rather than handing out a job id
  that nothing will ever fulfil.
- **`bi-run-background.mjs`** is the old generation logic, moved rather than
  rewritten, writing progress and the outcome to the job record.
- **`bi-status.mjs`** is one blob read. It deletes the record as soon as it
  serves a finished one: a founder's business plan should not sit in a store
  longer than it must.
- **`_bi_stages.mjs`** holds the schemas and prompts both halves need.

### Why Netlify Blobs

The two halves are separate invocations and need somewhere to meet. Blobs is
part of Netlify, needs no credentials and no provisioning, and these records
are worthless after a few minutes. Supabase would also have worked, but the BI
project store already degrades to 501 when Supabase is unconfigured — which is
this deployment's state — and a dossier that cannot be generated at all is a
worse failure than one that cannot be shared between devices.

### What the client gained

Polling is not merely a workaround; it is more robust than the stream was. A
dropped poll on a bad connection no longer costs the generation — the work
carries on server-side and the next poll picks it up. The old design lost
everything if the connection blinked. Proven: with **40% of polls dropped**, the
analysis still completes and is stored.

The founder now sees an elapsed counter, so a 90-second stage looks like work in
progress rather than a hang.

## The bug this fix nearly introduced

`bi-status.mjs` first used the shared `originRejected()` helper. It treats a
missing `Origin` header as hostile — and **browsers do not send `Origin` on
same-origin GET requests.** Every single poll would have returned 403 and the
endpoint would never once have answered.

Captured from real browser traffic rather than reasoned about:

```
POST /.netlify/functions/bi          origin=http://…  sec-fetch-site=same-origin
GET  /.netlify/functions/bi-status   origin=ABSENT    sec-fetch-site=same-origin
```

So the status endpoint checks `sec-fetch-site`, which is the header that
carries this for a GET. It is hardening either way: the endpoint is read-only,
rate limited, and the job id is 18 random bytes.

**The local emulator now enforces the same origin rules as the real functions**,
so a check that would 403 every browser request can no longer pass the suite.
That gap is why the first version looked fine.

## Verified

Against an emulator of the real topology — dispatcher, asynchronous worker, job
store, polling — with the model replaced by schema-complete fixtures:

| | |
|---|---|
| Whole flow, form → six stages → PDF, desktop and phone | **31 / 0** |
| Failure and edge paths | **42 / 0** |

The edge suite covers: a worker that fails mid-run, a dispatcher answering 503,
an unavailable job store, **40% of polls dropped**, a worker that dies without
writing anything (the client reports a timeout instead of spinning forever),
founder edits reaching the PDF, the rail after a reload, `Regenerate` replacing
rather than duplicating, and a browser that refuses localStorage.

## What is still unverified

The real Anthropic call is not exercised — the emulator replaces the model, so
this proves the plumbing and the client, not the quality of a generation. And
the deployed site is unreachable from the environment this was written in
(egress policy), so Netlify's actual background-invocation and Blobs behaviour
is written to documented semantics and has not been observed running.

**First deploy is the test.** If a stage still fails, `bi-status` now returns a
specific reason — missing API key, store unavailable, timed out, cut short —
instead of the opaque "no result received".

## Configuration this now needs

- `ANTHROPIC_API_KEY` — unchanged, still required.
- **Netlify Blobs must be enabled for the site.** It is on by default; if it is
  not, the dispatcher returns a clear 503 rather than failing silently.
- `BI_MODEL`, `BI_ENABLED`, `BI_TOKEN_BUDGET_HOURLY` — unchanged.
