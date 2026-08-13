---
name: check-into-lobby
description: Announce this assistant's presence in a registry room (default lobby). Use when the user or agent should check in (or out) via the hosted MCP registry. Supports named rooms; game rooms also allow user participants.
---

# Check into a room

Default room id is **`lobby`** (`type: general`). Do not invent a room id unless the user names one that already exists (or an operator creates it with `create_room`).

Rooms are MCP common areas. Not Slack. Not Grok Bot group chats.

## When to run

- User asks this assistant to announce presence / check into the lobby or a named room
- User says they are "here" or available in a registry room
- User asks to check out / leave
- In a **game** room, the user themselves may check in as `participant_kind: user`

## Steps

1. Ensure assistants are on the allowlist (`register_assistants`) before assistant check-in.
2. Optionally call `list_rooms` if the user is unsure which rooms exist.
3. Assistant check-in: `check_in` with `{ "assistant_id": "<id>" }` (omit `room` for `lobby`).
4. User check-in (game rooms only): `check_in` with `{ "room": "<game-room-id>", "participant_kind": "user" }`. General rooms reject user participants.
5. Confirm from the tool result (`participant.room_id`, `last_seen`).
6. Leave: `check_out` with the matching `assistant_id` or `participant_kind: "user"`.

## Notes

- Presence is visible via `list_room` on the same hosted registry.
- Game metadata from `list_room` is a stub only (`status: "stub"`). Do not invent prizes or payouts.
- This is not Grok Bot native federation and not a Slack bot.
