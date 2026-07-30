# Decision: Install `last30days` as a repo-native Claude Code skill

**Date:** 2026-07-29 · **Status:** Shipped

## Decision

Vendor the third-party `last30days` research skill (v3.18.4, MIT, by
mvanhorn) into `.claude/skills/last30days/` in this repository, flattened so
`SKILL.md` sits at the top level of the skill directory.

The upstream distribution ships the skill nested at
`last30days-skill-main/skills/last30days/SKILL.md`, which no skill loader
recognizes. Every host — Claude Code (project `.claude/skills/<name>/` or
personal `~/.claude/skills/<name>/`), the claude.ai skill uploader, Codex,
Gemini CLI — requires `SKILL.md` as a direct child of the skill directory,
with `scripts/` as its sibling. Upstream's own `build-skill.sh` confirms this
by repackaging with a single top-level `last30days/` prefix.

## What was changed relative to upstream

1. **Flattened** `skills/last30days/*` to the skill root — `SKILL.md`,
   `scripts/`, `references/` are now siblings.
2. **Fixed 10 stale engine paths in `SKILL.md`.** The setup and welcome steps
   called `python3 skills/last30days/scripts/last30days.py`, a path that
   resolves in no install layout. They now use
   `"${SKILL_DIR}/scripts/last30days.py"`, matching the convention the other
   22 engine call sites in the file already used.
3. **Fixed `scripts/lib/prescriptions.py`.** `ENGINE_CLI` was the hardcoded
   string `python3 skills/last30days/scripts/last30days.py`, printed to users
   inside `doctor` fix hints. It now resolves from `__file__`, so the printed
   command is copy-pasteable from any layout.
4. **Dropped non-runtime files** per upstream's own `.skillignore`: dev/eval
   scripts (`build-skill.sh`, `compare.sh`, `verify_v3.py`, the two
   `setup-*.sh` credential helpers, three test scripts), the `agents/`
   OpenAI variant, the Go MCP server, plugin manifests, and repo CI docs.
   111 files ship, well under the 200-file cap the uploader enforces.
5. **Kept** `LICENSE` (MIT attribution is required when vendoring) and
   `CONFIGURATION.md` (the `doctor` fix hints tell users to read it, so it has
   to travel with the skill).

## Runtime requirements

- **Python 3.12+.** The engine hard-refuses older interpreters. If the default
  `python3` is older, set `LAST30DAYS_PYTHON=/path/to/python3.12` — every call
  site in `SKILL.md` honors it.
- **No Python dependencies.** Standard library only (`jieba` is an optional
  CJK enhancement, guarded).
- **Zero keys needed to run.** Reddit, Hacker News, Polymarket, GitHub, and
  web grounding are keyless. X, YouTube, TikTok, and Instagram need either
  browser cookies, a free ScrapeCreators key, or an xAI key; `doctor` reports
  exactly what is on and what is missing.

## Rationale

Committing to the repo rather than installing into `~/.claude/skills/` is
deliberate: remote Claude Code containers are ephemeral, so a personal install
disappears with the session. Repo-native means every session in this
repository — local, web, or triggered — has the skill without setup, which is
the same reasoning behind `.claude/agents/` in the MWINDA OS bootstrap.

Trade-off accepted: 2.4 MB of vendored third-party Python lands in a static
marketing-site repo. Alternative considered and rejected: install it as a
Claude Code plugin from the upstream marketplace, which keeps the repo clean
but reintroduces the stale-clone bug upstream's own `STEP 0` warns about and
loses the two path fixes above.

## Verification

From `.claude/skills/last30days/` with `python3.12`:

- `scripts/last30days.py --help` — exits 0, full flag surface.
- `scripts/last30days.py --preflight` — "Ready to research with safe defaults."
- `scripts/last30days.py "ai agents" --mock --emit=compact` — full pipeline,
  badge renders `last30days v3.18.4`, version resolved from `SKILL.md` (proving
  the flat layout needs no plugin manifest).
- `scripts/last30days.py doctor` — four-state audit renders; fix hints print
  absolute engine paths.

## Upgrading

Re-run the flatten from a fresh upstream release and re-apply items 2 and 3
above; they are not yet fixed upstream. Worth opening a PR against
`mvanhorn/last30days-skill` so the next upgrade is a straight copy.
