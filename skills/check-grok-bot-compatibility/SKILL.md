---
name: check-grok-bot-compatibility
description: Review a plugin (publisher's or a customer's) for Grok Bot compatibility. Use when auditing a repo before marketplace submit, when an AE/FE is reviewing a customer connector, or when someone asks whether a plugin will work in Grok Bot vs Cursor IDE only. Report mismatches; do not auto-reject.
---

# Check Grok Bot compatibility

Review the plugin tree the user points at (or the current repo). **Report mismatches; do not auto-reject.** MCP servers and skills are surface-agnostic. IDE lifecycle hooks imply IDE-oriented packaging.

## Review checklist

Go through each item. Mark **pass**, **warn**, or **fail**, with a one-line why.

### Manifest

| Check | Fail / warn if |
| --- | --- |
| Agent Plugins root `plugin.json` present | Missing, or only `.cursor-plugin/plugin.json` with no portable skills/MCP story |
| `$schema` is `https://agent-plugins.org/schemas/1.0.0/plugin.schema.json` | Missing or wrong for an Agent Plugin |
| `name` is valid kebab-case | Uppercase, spaces, underscores-only, or other invalid id |
| `description` present and specific | Missing, empty, or "example stub" with no real job |
| `version` / `author` present | Missing (warn if optional fields omitted but name/description ok) |

### Grok Bot portability

| Check | Fail / warn if |
| --- | --- |
| No IDE-only components required for core value | `hooks/` tied to Tab, `workspaceOpen`, file-edit, etc.; rules/agents/commands that only make sense in the IDE |
| Skills are portable | Skill text assumes open editors, workspace paths, or IDE UI the Grok Bot agent cannot use |
| MCP is optional and secret-safe | Real tokens in repo; `${VAR}` used without declaring `variables`; `.env` committed |

IDE-only components are a **warn** (or "IDE-only; Grok Bot will not benefit"), not an automatic reject of the whole repo — unless the plugin has nothing Grok Bot can load (no skills, no MCP).

### Skills

| Check | Fail / warn if |
| --- | --- |
| Each skill is `skills/<name>/SKILL.md` | Wrong path or missing `SKILL.md` |
| YAML frontmatter has `name` + `description` | Missing fields |
| `name` matches folder name | Mismatch |
| `description` says **when** to use the skill | Only a vague label |

### Secrets and MCP

| Check | Fail / warn if |
| --- | --- |
| No committed secrets | API keys, tokens, private URLs with credentials in git |
| `mcp.json` uses `${VAR}` placeholders only | Hardcoded secrets |
| Every `${VAR}` declared in manifest `variables` | Undeclared placeholders |
| Values not stored in the plugin | Instruct: set in dashboard **Plugins → Configure** |

### Repo hygiene

| Check | Fail / warn if |
| --- | --- |
| `README.md` explains install, configure, submit | Missing or stub-only |
| License present (marketplace expects open source) | Missing |
| No invented APIs | Repo tells publishers to add a `surfaces` field (proposed, **not shipped**) |

## Important non-facts (do not recommend)

- **Do not** tell publishers to add a `surfaces` manifest field. It does not exist yet.
- **Do not** claim team marketplaces are confirmed in Grok Bot. Say: documented for Cursor surfaces (Agent Window, IDE, CLI); Grok Bot coverage unverified.
- **Do not** send anyone to `github.com/xai-org/plugin-marketplace` to submit.
- **Do not** invent a default-connector tier or request form.

## Output format

Return a short report:

1. **Summary** — one sentence: ready for Grok Bot–oriented marketplace submit, needs fixes, or IDE-only.
2. **Findings** — table or bullets with severity (`fail` / `warn` / `pass`).
3. **Next steps** — concrete file-level fixes. If ready, point to `get-listed-in-grok-bot`. If starting over, point to `scaffold-grok-bot-plugin`.
