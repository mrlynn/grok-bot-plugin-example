# PRD: Grok Bot plugin submission path + hosted registry

## Problem

Publishers need a clear path into Grok Bot (marketplace / Agent Plugins). Separately, assistants on different accounts need a **shared** place to register and show presence. Skills-only packs cannot do cross-user state.

## Product

1. **Publisher companion** — skills that explain submit path, scaffold, compatibility, distribution tiers.
2. **Hosted registry MCP** — remote Streamable HTTP server where approved Grok Bot assistants register and check into **rooms**.

Installing the plugin means: my approved assistants **may** appear in the registry after the user configures variables and explicitly registers. **Install alone does not register or check anyone in.**

## Rooms

Rooms are common areas inside the hosted MCP. They are not Slack and not Grok Bot group chats.

- Types in v1: `general` | `game`
- Default room `lobby` (`general`) exists at boot
- Operators can `create_room`
- Anyone authenticated can `list_rooms` / `list_room`
- `general`: assistants only
- `game`: users and assistants; game fields are stubs only (no money)

## Success (v1)

- Two different user ids can register + check assistants into `lobby` and both appear in `list_room`
- Operator can create a `game` room; user + assistant participants both appear
- No secrets in the plugin repo; tokens via Plugins → Configure / server env

## Out of scope

- Native Grok Bot messaging between accounts
- Slack bots, Slack apps, GitHub PATs
- Settings UI for the registry
- Prizes, payouts, compensation, payment APIs
- Auto-register or auto-check-in on install

---

## 7. Onboarding copy (skills)

Skills must follow this section. Use the **canonical phrases** as triggers and in user-facing prompts.

### 7.1 Canonical phrases

| Phrase | Skill | Behavior |
| --- | --- | --- |
| Register my assistants for rooms | `register-my-assistants` | List real roster → ask who to approve → `register_assistants` (replace) → offer lobby check-in |
| Check into the lobby | `check-into-lobby` | `check_in` for an **approved** assistant into `lobby` |
| Check out of the lobby | `check-into-lobby` | `check_out` for that assistant |
| Who is in the lobby? | `who-is-in-the-room` | `list_room` with room `lobby` (or default) |
| Who is registered for rooms? | `who-is-in-the-room` | `list_registry` (**operator token only**) |

### 7.2 Install

- Installing/configuring the plugin does **not** call `register_assistants` or `check_in`.
- There is **no Settings UI** for roster approval.
- There is **no Slack** integration.

### 7.3 Register my assistants for rooms

1. List the **real** roster of assistants for this user/account (from client context, or ask the user to name them if unknown). Never invent ids.
2. Ask which ones to approve for rooms. **Never auto-approve everyone on install or on first run.**
3. Call `register_assistants` with only the approved set. The tool **replaces** that user's entire allowlist.
4. Offer lobby check-in ("Check into the lobby?"). If they decline, **stop**.

### 7.4 Check into / out of the lobby

- Only check in assistants already on the allowlist.
- If the id is not approved, refuse with exactly:  
  `That assistant is not approved for rooms. Say 'register my assistants for rooms' first.`
- Default room is `lobby`. Do not invent another room unless the user names one.

### 7.5 Who is in / registered

- "Who is in the lobby?" → `list_room` (`lobby` only for this phrase).
- "Who is registered for rooms?" → `list_registry`, operator-token only. If forbidden, say the caller needs an operator token; do not fake a registry dump.

### 7.6 Five-line tester script

Paste these five lines (one turn each, or as a checklist) after the plugin is configured:

```text
Register my assistants for rooms
Check into the lobby
Who is in the lobby?
Check out of the lobby
Who is registered for rooms?
```
