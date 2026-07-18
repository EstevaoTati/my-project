# Decision: Bootstrap MWINDA OS as repo-native infrastructure

**Date:** 2026-07-17 · **Status:** Shipped (PR #5, merged)

## Decision

Build the founder's "MWINDA OS" (executive AI operating system) as files in
this repository rather than as a pasted chat persona:

- **Kernel** — `CLAUDE.md`: identity, priorities, checklists, communication
  style. Loads automatically into every Claude session.
- **Agents** — `.claude/agents/{architect,researcher,strategist}.md`:
  specialized subagents invocable by name.
- **Routine** — "Mwinda Monday Priorities Brief"
  (trigger `trig_01K23WJWLQhoAsps6ZYgctVQ`): every Monday 07:00 UTC, a fresh
  session reviews the repo and opens a draft PR with a one-page brief to
  `docs/briefs/`; push + email notifications enabled.
- **Public face** — `os.html`: brand-consistent preview page of the system.

## Rationale

Chat context is ephemeral; only committed files persist across sessions.
A prompt cannot grant memory or scheduling — infrastructure can. The
ecosystem crystallizes from small working pieces (one kernel, three agents,
one routine) instead of being designed up front.

## Rejected alternative

A monolithic "MWINDA OS" persona prompt pasted per session: zero persistence,
no automation, no agent specialization.
