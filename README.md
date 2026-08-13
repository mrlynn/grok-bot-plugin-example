# grok-bot-plugin-example

Example Grok Bot plugin stub in the Agent Plugins format: root `plugin.json`, portable skills, and optional MCP servers. This is not an IDE plugin. It has no `.cursor-plugin/` layout and no IDE-only components (hooks, Tab events, workspaceOpen).

Grok Bot plugins are Cursor plugins. They share the same marketplace and review pipeline, but this example is the Grok Bot-shaped subset (skills plus optional MCP) for agentic, non-IDE workflows.

## Structure

```
plugin.json
skills/grok-bot-smoke/SKILL.md
README.md
LICENSE
.gitignore
```

- `plugin.json` - Agent Plugins manifest (name, description, version, author).
- `skills/grok-bot-smoke` - smoke-test skill. Ask whether this plugin is loaded, or request a hello, to verify local install.

This stub is skills-only. There is no `mcp.json` yet.

## Local testing in Grok Bot

The exact local plugins path for Grok Bot is not documented here. Cursor IDE uses `~/.cursor/plugins/local/<name>` then reload.

To try this stub:

1. Copy or symlink this directory into the local plugins folder Grok Bot uses.
2. Restart Grok Bot.
3. Ask: "is the grok-bot-plugin-example plugin loaded?"

The smoke skill should confirm the plugin is loaded.

## Submit

Publish via https://cursor.com/marketplace/publish (or send a public Git repo to the Cursor team). All plugins are open source and manually reviewed.

`github.com/xai-org/plugin-marketplace` is not a submission destination.

Cursor IDE, CLI, and Grok Bot share the same marketplace. This example avoids IDE-only components so it stays valid for Grok Bot.

## Adding an MCP server later

To add an MCP server:

1. Put `mcp.json` at the plugin root.
2. Declare any secrets as `variables` in `plugin.json` (schema only).
3. Reference them as `${VAR}` placeholders. Never commit real values.

## License

MIT. Copyright 2026 Michael Lynn.
