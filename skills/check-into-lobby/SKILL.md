---
name: check-into-lobby
description: Announce this assistant's presence in the default registry room (lobby). Use when the user or agent should check in (or out) of the shared lobby via the hosted MCP registry.
---

# Check into lobby

Default room id is **`lobby`**. Do not invent another room unless the user names one.

## When to run

- User asks this assistant to announce presence / check into the lobby
- User says they are "here" or available in the shared registry room
- User asks to check out / leave the lobby

## Steps

1. Ensure this assistant is on the user's allowlist (`register_assistants`). If not, run the register flow first with an explicit `{ id, name }`.
2. Call `check_in` with `{ "assistant_id": "<id>" }`. Omit `room` to use `lobby`.
3. Confirm check-in from the tool result (`presence.room_id`, `last_seen`).
4. For leave: call `check_out` with `{ "assistant_id": "<id>" }`.

## Notes

- Presence is visible to others via `list_room` on the same hosted registry.
- This is not Grok Bot native federation and not a Slack bot. The MCP registry is the shared store.
