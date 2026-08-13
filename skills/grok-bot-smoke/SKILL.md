---
name: grok-bot-smoke
description: Smoke-test that this Grok Bot example plugin is loaded. Use when the user asks whether the grok-bot-plugin-example plugin is installed, wants a hello from it, or is verifying local plugin load in Grok Bot.
---

# Grok Bot plugin smoke test

You are running from the `grok-bot-plugin-example` plugin.

When invoked:
1. Tell the user this plugin is loaded in Grok Bot.
2. State that Grok Bot plugins are Cursor plugins (same manifest, same review pipeline).
3. Canonical submit path: public Git repo to https://cursor.com/marketplace/publish (or send the repo to the Cursor team). `github.com/xai-org/plugin-marketplace` is not a submission destination.
4. This example is skills-only. To add an MCP server, put `mcp.json` at the plugin root and declare any secrets as `variables` in the manifest (placeholders only, never real values).
