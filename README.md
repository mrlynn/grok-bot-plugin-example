# grok-bot-plugin-example

Agent plugin that helps a **publisher** (or a Cursor AE/FE answering one) go from "I have an MCP server or skill" to "it appears in Grok Bot," without a hand-routed Slack thread.

Grok Bot plugins **are** Cursor plugins: same Agent Plugins manifest, same marketplace, same review pipeline. This repo is the Grok Bot-facing companion (surfaces, submit misconceptions, tiers, compatibility). It is not a second marketplace and not a generic Cursor scaffold — for that, use the marketplace **"Create Plugin"** pack.

## Skills

| Skill | When to use it |
| --- | --- |
| [`get-listed-in-grok-bot`](skills/get-listed-in-grok-bot/SKILL.md) | "How do I get my MCP/plugin into Grok Bot?" Canonical answer for AEs to paste. |
| [`scaffold-grok-bot-plugin`](skills/scaffold-grok-bot-plugin/SKILL.md) | Starting a Grok Bot–ready Agent Plugin (copy-pasteable files). |
| [`check-grok-bot-compatibility`](skills/check-grok-bot-compatibility/SKILL.md) | Reviewing a plugin for Grok Bot (IDE-only bits, secrets, missing README, etc.). |
| [`distribution-tiers`](skills/distribution-tiers/SKILL.md) | Public vs team/private vs "default connector for everyone." |
| [`grok-bot-smoke`](skills/grok-bot-smoke/SKILL.md) | Optional hello / load check. Not the product. |

## Structure

```text
plugin.json
skills/
  get-listed-in-grok-bot/SKILL.md
  scaffold-grok-bot-plugin/SKILL.md
  check-grok-bot-compatibility/SKILL.md
  distribution-tiers/SKILL.md
  grok-bot-smoke/SKILL.md
README.md
LICENSE
.gitignore
```

Skills-only Agent Plugin. No `mcp.json`, no `.cursor-plugin/`, no hooks, rules, agents, or commands.

## Submit path (canonical)

1. Public Git repository.
2. Agent Plugins layout: root `plugin.json` (`$schema` from agent-plugins.org), skills and/or `mcp.json`.
3. Submit at **https://cursor.com/marketplace/publish** (or send the repo to the Cursor team).
4. Open source + manual review (including updates).

Cursor IDE, CLI, and Grok Bot share the same marketplace listing today.

**Not a submission destination:** `github.com/xai-org/plugin-marketplace`. That guess is wrong; do not use it.

## Distribution tiers (short)

| Goal | Reality |
| --- | --- |
| Available to anyone | Public marketplace listing |
| Team / private | Dashboard → Plugins (documented for Cursor; **Grok Bot coverage unverified**) |
| Default connector for everyone | **Does not exist.** Answer is marketplace listing, not a special program |

## Local testing

**Cursor IDE (documented):** copy or symlink into `~/.cursor/plugins/local/<name>`, then reload.

```bash
ln -s /path/to/grok-bot-plugin-example ~/.cursor/plugins/local/grok-bot-plugin-example
```

**Grok Bot:** exact local path is **not confirmed** (Electron userData renamed from Sand to Grok Bot). Do not assume it shares `~/.cursor/plugins/local/`. Verify against the current client.

After load, ask whether this plugin is installed, or ask how to get an MCP into Grok Bot.

## Secrets (when you add MCP later)

Declare `variables` (JSON Schema, names only) in the manifest. Use `${VAR}` only in `mcp.json`. Set values in the dashboard under **Plugins → Configure**. Never store secrets in the plugin.

## What this is not

- Not a second marketplace or fork of the plugin standard
- Not a default-connector program or request form
- Not a fix for legacy hardcoded client plugins
- Not an IDE plugin pack (no Tab hooks, `workspaceOpen`, rules-only layouts)
- Not a replacement for the marketplace "Create Plugin" pack (generic scaffold + review)

## License

MIT. Copyright 2026 Michael Lynn.
