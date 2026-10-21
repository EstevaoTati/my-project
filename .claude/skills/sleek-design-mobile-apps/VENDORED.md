# Vendored skill — provenance and prerequisites

`SKILL.md` is an unmodified copy of the upstream Sleek skill. Don't hand-edit it;
re-sync instead, so upstream fixes aren't lost to local drift.

| | |
|---|---|
| Upstream | https://github.com/sleekdotdesign/agent-skills |
| Path | `skills/design-mobile-apps/SKILL.md` |
| Commit | `9c821887c3e4c79366f8605b7738bbd1c38bf527` (2026-07-24) |
| License | MIT — see `LICENSE` |

## Why it's vendored rather than installed with `npx`

Upstream's install command is `npx skills add sleekdotdesign/agent-skills`, which
writes to `.agents/skills/`. Claude Code discovers skills in `.claude/skills/`,
so a skill installed that way is present but never offered — upstream's own
README flags this. Committing it here means every session in this repo picks it
up with no per-session install step, which matters because the container is
ephemeral.

## The skill is named `sleek-design-mobile-apps`, not `sleek`

Invoking `/sleek` does not resolve. Use the full name, or just describe the task
("design a screen in Sleek", "implement my Sleek project") and it triggers on
its description.

## Two prerequisites this repo's session container does not meet

1. **`SLEEK_API_KEY`** must be set. Unset here. The skill can provision one
   itself via its device flow — it prints a URL and a code to approve — or you
   can create one at https://sleek.design/agents/setup.
2. **Network access to `https://sleek.design`.** Currently blocked: the
   session's egress policy answers `403` to `CONNECT sleek.design:443`. Every
   API call in this skill will fail until that host is allowed for the
   environment. An admin can change this in the environment's network policy;
   see https://code.claude.com/docs/en/claude-code-on-the-web.

Both are environment settings, not defects in the skill. It works unchanged once
the host is reachable and a key is present.

## Re-syncing

```bash
git clone --depth 1 https://github.com/sleekdotdesign/agent-skills.git /tmp/sleek-skills
cp /tmp/sleek-skills/skills/design-mobile-apps/SKILL.md \
   .claude/skills/sleek-design-mobile-apps/SKILL.md
```

Then update the commit hash in the table above.

## Note for this repo specifically

The components endpoint accepts `?inlineIcons=true`, which returns self-contained
SVGs instead of `<iconify-icon>` web components backed by a runtime script from
`code.iconify.design`. That host is not in this site's CSP `script-src`
allowlist, so the default output renders every icon invisible once deployed.
**Pass `inlineIcons=true` when pulling components for this site** — it avoids the
manual inlining step that PR #18 had to do by hand. See
`docs/decisions/2026-07-27-242konnect-prototype.md`.
