---
name: scaffold-grok-bot-plugin
description: Scaffold a Grok Bot-ready Agent Plugin (root plugin.json, skills, optional mcp.json and variables). Use when a publisher or AE/FE wants to start a new plugin for Grok Bot, convert an MCP server into a marketplace plugin, or needs copy-pasteable file contents rather than a lecture. Prefer this over generic Cursor IDE scaffolding when the target is Grok Bot.
---

# Scaffold a Grok Bot plugin

Produce a **skills-only or skills+MCP Agent Plugin**. Output copy-pasteable files. Do not create `.cursor-plugin/`, hooks, rules, agents, or commands unless the user explicitly needs IDE components (and then warn those will not help in Grok Bot).

For generic Cursor scaffolding and pre-submit checks, point at the marketplace **"Create Plugin"** pack. This skill is the Grok Bot-shaped layout and constraints.

## Default layout

```text
my-connector/
├── plugin.json
├── skills/
│   └── <skill-name>/
│       └── SKILL.md
├── mcp.json          # optional — only if shipping an MCP server
├── README.md
└── LICENSE
```

## What NOT to include for Grok Bot

Omit these unless the user also needs Cursor IDE behavior:

- `.cursor-plugin/` layout
- `hooks/` (Tab hooks, `workspaceOpen`, file-edit hooks, etc.)
- `rules/` that only make sense in an editor
- `agents/`, `commands/`
- Any invented `surfaces` manifest field (not shipped)

MCP servers and skills are surface-agnostic. IDE lifecycle hooks are not.

## 1. `plugin.json`

Replace placeholders. `name` must be lowercase kebab-case.

```json
{
  "$schema": "https://agent-plugins.org/schemas/1.0.0/plugin.schema.json",
  "name": "my-connector",
  "version": "0.1.0",
  "description": "One or two sentences: what the plugin does and when to install it.",
  "author": {
    "name": "Publisher Name"
  },
  "license": "MIT",
  "repository": "https://github.com/org/my-connector",
  "keywords": ["mcp", "grok-bot"]
}
```

If the plugin has an MCP server that needs secrets, add a `variables` JSON Schema (names only, never values). Users/admins set values in the dashboard under **Plugins → Configure**:

```json
{
  "$schema": "https://agent-plugins.org/schemas/1.0.0/plugin.schema.json",
  "name": "my-connector",
  "version": "0.1.0",
  "description": "Example HTTP MCP connector.",
  "author": { "name": "Publisher Name" },
  "license": "MIT",
  "variables": {
    "type": "object",
    "properties": {
      "API_TOKEN": {
        "type": "string",
        "title": "API token",
        "description": "Bearer token for the MCP server"
      }
    },
    "required": ["API_TOKEN"]
  }
}
```

## 2. Skill: `skills/<skill-name>/SKILL.md`

Folder name must match frontmatter `name`. `description` must say **what** it does and **when** to use it.

```markdown
---
name: my-connector-guide
description: Help the user accomplish X with My Connector. Use when they ask about Y or need Z.
---

# My Connector guide

Clear steps the agent should follow when this skill is active.
```

Keep skills small and actionable. Skills-only plugins are valid for Grok Bot.

## 3. Optional `mcp.json`

Only if shipping an MCP server. Use `${VAR}` placeholders that match `variables` property names. Never commit real secrets.

```json
{
  "mcpServers": {
    "my-connector": {
      "url": "https://mcp.example.com/mcp",
      "headers": {
        "Authorization": "Bearer ${API_TOKEN}"
      }
    }
  }
}
```

Stdio MCP example shape (adjust command/args for the publisher's server):

```json
{
  "mcpServers": {
    "my-connector": {
      "command": "npx",
      "args": ["-y", "my-connector-mcp"],
      "env": {
        "API_TOKEN": "${API_TOKEN}"
      }
    }
  }
}
```

## 4. `README.md` (minimum)

Cover: what the plugin does, required configure variables, how to test locally in Cursor IDE, submit link `https://cursor.com/marketplace/publish`, MIT (or their license).

## 5. Local testing (honest)

**Cursor IDE (documented):**

```bash
ln -s /path/to/my-connector ~/.cursor/plugins/local/my-connector
```

Then reload the window (or restart Cursor) and verify skills/MCP load.

**Grok Bot:** The exact local plugins path is **not confirmed** here (Electron userData was renamed from Sand to Grok Bot). Do not claim Grok Bot shares `~/.cursor/plugins/local/`. Say local load in Grok Bot should be verified against the current client.

## 6. Submit

Public repo → https://cursor.com/marketplace/publish. Open source + manual review.  
`github.com/xai-org/plugin-marketplace` is **not** a submission destination.

## After scaffolding

Offer to run the checklist in `check-grok-bot-compatibility`, then point at `get-listed-in-grok-bot` for the publish path and `distribution-tiers` if they ask about team-only or "default for everyone."
