# 2026-09-26 — AI Business Intelligence: reliable end to end, and faster

## Objective

Every step from the idea to the dossier works, the founder can always
download the PDF, and the wait is as short as the model allows.

## What was wrong (found by running the real functions end to end)

| Problem | Effect |
|---|---|
| A finished job was deleted on its first read | One lost reply (phone changing network, tab backgrounded) lost the stage: "lost contact with the engine" |
| The job id lived only in memory | A reload or an in-app browser recycling the page mid-generation threw the work away |
| Every request echoed all previous stages | 68 KB by the roadmap step on the test project, close to the dispatcher's 96 KB limit: a long plan could have been refused with "project too large" |
| The plan was one 17-section call | 2-4 minutes, and the one stage that could hit its token ceiling |
| Model output trusted as-is | An array sent as a string, or "1 500" for a number, became an empty panel or a projection of zeros |
| The rail's "Dossier" showed the copy built at page load | Often empty or stale |
| The access-link message was written into the first step | Hidden while the dossier (where the button is) is on screen: the button looked dead |
| The dossier repeated the analysis summary/problem/solution before the plan's own | Every dossier said it twice; risks, assumptions to validate, financial inputs and roadmap objectives were missing |
| PDF: one text operator per word | ~900 KB for a text document; "≈", emoji and similar printed as "?"; table text overlapped its rules |

## Decisions

1. **Plan in two parallel halves** (`PLAN_PARTS`, 9 + 8 sections, 9k tokens
   each), merged into canonical order. About half the wall time, and far from
   the ceiling.
2. **Normalise every output to its schema, retry once** on truncated or
   incomplete answers, server-side, before reporting an error.
3. **Keep finished jobs until the browser acknowledges them**; delete on ack,
   sweep anything older than the TTL. Job ids now start with their birth time
   (8 hex digits) so the sweep needs only a key listing, never a read.
4. **Persist `project.pending[stage] = { jobId, at }`** and resume on load.
5. **Stages after the model depend only on the analysis and the model**
   (`DEPS`). Requests stay ~15-25 KB, and "Generate the complete dossier ⚡"
   runs the model then plan, financials, compliance and roadmap at once.
6. **Every failure shows its reason and a Retry button** where it happened.
7. **Dossier restructured**: the plan's narrative, then risks and
   mitigations, assumptions to validate, canvas, financial inputs + scenarios
   + month-by-month table + capital need, checklist with why/who, roadmap with
   objectives. No duplicated sections.
8. **PDF**: one operator per same-style run (~126 KB for 16 pages vs ~900 KB for
   13), more characters folded, invisible ones dropped, table baselines fixed.

## Trade-off

Plan, financials, compliance and roadmap no longer read each other: the
roadmap is written from the analysis and the business model, not from the
plan. In exchange, all four can run at once and every request is small. The
plan already did not see the financials; nothing that was consistent before
is inconsistent now.

## How it was verified

A harness runs the **real** `netlify/functions` with `@anthropic-ai/sdk` and
`@netlify/blobs` replaced by in-process fakes (Node module hooks). The fake
model streams schema-shaped French business prose at a set speed and can be
told to truncate, return incomplete or malformed output, fail with 5xx or a bad
key. Playwright drives the page.

- API: ack flow, plan halves merged in order, truncation retried, malformed
  arrays repaired, incomplete twice gives an honest error, 5xx and bad-key
  messages, a 100 KB legacy request still accepted.
- Browser (desktop and 390 px phone): full step-by-step flow with PDF; one-click
  flow; reload mid-generation resumes the same job (dispatched once); a dropped
  "done" reply recovers; failure then Retry; PDF after the analysis alone, then
  "Generate the missing sections"; rail dossier is current. No page errors.
- PDF parsed with pdf.js: all sections present, no "?" substitutions; pages
  rendered and inspected.
- Realistic model speed (~220 chars/s, the harness's stand-in for a real
  model): all six sections one click at a time took 4 min 38 s of
  generation; with "Generate the complete dossier" the five sections after the
  analysis took 2 min 3 s.

The harness is in `scripts/bi-harness/` (own `package.json`, never deployed —
`/scripts/*` 404s). Run it after any change to the BI flow; see its README.
