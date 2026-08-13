---
name: get-listed-in-grok-bot
description: Canonical path to get an MCP server or plugin into Grok Bot. Use when a publisher, customer, or Cursor AE/FE asks how to list a connector in Grok Bot, how to submit to the marketplace, whether github.com/xai-org/plugin-marketplace is the right place, or how to avoid a hand-routed Slack thread.
---

# Get listed in Grok Bot

You are answering the discovery question: **how does my MCP / plugin show up in Grok Bot?**

Grok Bot plugins are Cursor plugins. Same Agent Plugins (or Cursor Plugins) format, same marketplace, same review pipeline. There is no separate Grok Bot submit form and no second marketplace.

## Canonical submit path

1. Put the plugin in a **public Git repository**.
2. Use **Agent Plugins** format for Grok Bot (recommended): root `plugin.json` with `$schema` `https://agent-plugins.org/schemas/1.0.0/plugin.schema.json`, plus `skills/` and/or `mcp.json`.
3. Submit the repo at **https://cursor.com/marketplace/publish** (or send the public repo URL to the Cursor team).
4. Expect **manual review**. All marketplace plugins must be **open source**. Updates are reviewed again before they go live.
5. After listing, the same marketplace entry is what Cursor IDE, CLI, and Grok Bot share today. Team admins can still disable a marketplace plugin for their org.

## Kill this misconception by name

**`github.com/xai-org/plugin-marketplace` is NOT a submission destination.**

A customer guessed that path on 2026-08-12. Do not open a PR there, do not tell publishers to fork it, and do not treat it as an official ingest. The only public submit path is `cursor.com/marketplace/publish` (or sending the public repo to the Cursor team).

## What to tell an AE/FE to paste

Use this short answer when someone asks "how do I get my MCP into Grok Bot?":

> Ship a public Git repo in Agent Plugins format (root `plugin.json`, skills and/or `mcp.json`). Submit it at https://cursor.com/marketplace/publish. Plugins are open source and manually reviewed. Cursor IDE, CLI, and Grok Bot share that listing. `github.com/xai-org/plugin-marketplace` is not a submission destination. There is no separate "default connector" program; public availability is the marketplace listing. Team-only distribution is Dashboard → Plugins (documented for Cursor surfaces; Grok Bot coverage unverified).

## Format choice (keep it short)

| Need | Format |
| --- | --- |
| Skills and/or MCP for Grok Bot (and Cursor) | **Agent Plugins** — root `plugin.json` |
| Also need IDE rules, hooks, agents, or commands | Cursor Plugins — `.cursor-plugin/plugin.json` (IDE parts will not help in Grok Bot) |

For Grok Bot-first work, default to Agent Plugins. Point people at the marketplace "Create Plugin" pack for generic Cursor scaffolding; this skill is the Grok Bot-specific path, not a second scaffold.

## Do not invent

- Do not invent a default-connector request form or special program.
- Do not claim team marketplaces are confirmed in Grok Bot (documented for Agent Window, IDE, and CLI; Grok Bot coverage unverified).
- Do not tell publishers to add a `surfaces` field (proposed, not shipped).
- Do not try to fix legacy hardcoded client plugins here.

## Related skills in this plugin

- New plugin from scratch → `scaffold-grok-bot-plugin`
- Review an existing plugin → `check-grok-bot-compatibility`
- Public vs team vs "default for everyone" → `distribution-tiers`
