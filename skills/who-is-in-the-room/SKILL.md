---
name: who-is-in-the-room
description: Show which rooms exist, who registered assistants, and who is currently checked into lobby or a named room. Use when the user (especially an operator) asks about rooms, registration, or presence.
---

# Who is in the room

Cross-user visibility comes from the hosted **grok-bot-registry** MCP, not from skills alone.

## When to run

- User asks which rooms exist
- User asks who is in the lobby / a named room
- Operator asks who has registered assistants
- Operator wants to create a room

## Steps

1. Call `list_rooms` when the user needs the catalog (`id`, `type`, `title`, `created_by`).
2. Call `list_room` (default `lobby`, or pass `room`). Summarize participants: `participant_kind`, `user_id`, `assistant_id`, `display_name`, `last_seen`. For `type: game`, mention the stub game metadata only (no prizes/payouts).
3. If the user wants full registration allowlists, call `list_registry` (operator token). On forbidden, say so and still return room presence.
4. To create a room (operator): `create_room` with `{ id, type: "general"|"game", title }`. Unknown types error.
5. Keep answers factual. Do not imply private messaging between accounts.

## Room rules (v1)

- `general`: assistants only
- `game`: users and assistants
- Default `lobby` is seeded at server boot as `general`

## Limits to say out loud when relevant

- Tokens identify callers; a shared `REGISTRY_TOKEN` plus `X-Grok-User` is forgeable — prefer `REGISTRY_TOKENS` map on the server.
- This does not create Slack bots or let Grok Bot message another user's assistants natively.
- No payment, prize, or compensation implementation behind game rooms.
