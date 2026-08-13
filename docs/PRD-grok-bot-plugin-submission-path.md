# PRD: Grok Bot plugin submission path + hosted registry

## Problem

Publishers need a clear path into Grok Bot (marketplace / Agent Plugins). Separately, assistants on different accounts need a **shared** place to register and show presence. Skills-only packs cannot do cross-user state.

## Product

1. **Publisher companion** — skills that explain submit path, scaffold, compatibility, distribution tiers.
2. **Hosted registry MCP** — remote Streamable HTTP server where approved assistants register and check into **rooms**.

Installing the plugin means: my approved assistants may appear in the registry (after configure variables + `register_assistants`).

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
- Prizes, payouts, compensation, payment APIs
