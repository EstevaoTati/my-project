# Ground the BI engine on institutional data, without pretending to read the law

**Date:** 2026-08-23
**Status:** accepted

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
