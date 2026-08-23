# Ground the BI engine on institutional data, without pretending to read the law

**Date:** 2026-08-23
**Status:** accepted, amended same day — see *Amendment* below

## Context

The AI Business Intelligence engine produced entire dossiers from the model's
memory. That is defensible for structure and reasoning and indefensible for
figures: a business plan whose market data is recalled rather than sourced is
exactly the artefact a bank discards.

Ten sources were proposed: World Bank B-READY, Worldwide Governance Indicators,
UNDP HDR, UNCTAD Investment Policy Hub, WIPO Lex, ILO NATLEX, OHCHR UHRI and the
UN Treaty Collection.

Investigating them, they are not one category. Four are machine-readable. Five
are human-facing legal databases with no public API. One of the supplied links
was the UN portal's own `PageNotFound` error page.

## Decision

**Split them by what they actually offer, and never blur the two.**

*Machine sources* are ingested on a schedule into `reference_indicators` and
injected into the prompt inside a `<reference_data>` fence, with the model
instructed to prefer them over recall and never contradict one.

*Portal sources* are never scraped, never summarised, never quoted. They are
attached to the dossier as verification links, and the prompt says explicitly:
*"You have NOT read them. Do not quote, summarise or cite their contents."*

Three supporting decisions:

**Refresh on a schedule, not per generation.** A stage already runs 20–120 s;
external calls inside that window make a paying founder's dossier hostage to
another organisation's uptime, make the same country yield different baselines
week to week, and multiply requests against services that are being used for
free.

**Sources are attached by the server from a fixed registry, never produced by
the model.** A citation the model invents is worse than no citation, because it
carries the appearance of having been checked.

**The absence of data is displayed, not hidden.** When no reference statistics
exist for a country, the panel says so in a warning colour rather than falling
silent, and the dossier's lead sentence changes accordingly.

## Consequences

- The engine degrades to exactly its previous behaviour with no database, no
  key and no network. Reference data enriches; it never gates.
- B-READY arrives through a manual CSV export, because it has no API. Honest
  friction beats a scraper that breaks quietly.
- Country deep links exist only where the URL pattern is stable. Everywhere
  else the UI says *"index — filter by country"* rather than implying more
  precision than we have.
- The `projects` table gained `sources` and `grounding` columns: a dossier must
  keep citing the vintage it was written from, even after a later refresh moves
  the numbers.

## Alternatives rejected

**Scrape the legal portals.** Rejected on licensing and on fragility, but
mostly on honesty: it would let the engine sound like it had read a statute it
had merely pattern-matched.

**Let the model cite sources itself.** Rejected — this is precisely where
fabrication is most costly and least detectable.

**Ship without the ungrounded warning.** Rejected. A product that is silent
when it lacks data teaches users to trust it uniformly, which is the opposite
of what a business plan needs.

---

## Amendment — the registry is internal

The decision above shipped a "Sources and verification" panel on the compliance
stage and a deduplicated bibliography at the end of the dossier. The founder
reversed that the same day, and was right to.

**Which official databases the engine consults is methodology.** Assembling
that registry — establishing which sources have an API and which do not, which
country URL patterns are real, that one supplied link was a 404 page — is a
meaningful part of what MWINDA AI Business Intelligence is. Printing it at the
end of every dossier hands it to anyone who runs a single free analysis.

So: the registry shapes the prompt and never crosses to the browser. No source
list, link or grounding count is sent to the client, rendered in a dossier, or
stored on a project row. `projects.sources` and `projects.grounding` are
dropped in `0005`. The audit log is the only place its use is recorded.

**What was weighed against it.** The panel had a real protective function: it
told a reader where to verify a legal claim. That function survives without it
— the compliance stage keeps its legal banner and its per-item *"confirm with"*
field, and the prompt still instructs the model to name **the kind of body**
that settles each obligation. The reader is told to verify with the national IP
office; they are simply not handed our list of databases.

**What did not change.** Everything about how the engine is grounded. The facts
still come from real statistics, the model is still told it has not read the
legal portals, and citations are still never invented. The output is unchanged
in substance — only the advertising of the method is gone.
