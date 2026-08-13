---
name: who-is-in-the-room
description: Show who registered assistants in the shared registry and who is currently checked into the lobby (or a named room). Use when the user, especially an operator, asks who registered or who is present.
---

# Who is in the room

Cross-user visibility comes from the hosted **grok-bot-registry** MCP, not from skills alone.

## When to run

- User asks who is in the lobby / room
- Operator asks who has registered assistants
- User asks for a presence roll call

## Steps

1. Call `list_room` (default room `lobby`, or pass `room` if named). Summarize `user_id`, `assistant_id`, `name`, `last_seen`.
2. If the user wants the full registration allowlists (not just who is present), call `list_registry`. That tool requires an **operator** token (`role: operator` / list scope). If it fails with forbidden, say so and still return the `list_room` result.
3. Keep the answer factual. Do not imply private messaging between accounts.

## Limits to say out loud when relevant

- Tokens identify callers; a shared `REGISTRY_TOKEN` plus `X-Grok-User` is forgeable — prefer `REGISTRY_TOKENS` map on the server.
- This does not create Slack bots or let Grok Bot message another user's assistants natively.
