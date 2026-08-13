---
name: check-into-lobby
description: >-
  Lobby presence for approved assistants. Use when the user says "Check into the
  lobby" or "Check out of the lobby" (canonical), or asks this assistant to
  announce or leave lobby presence. Refuses unapproved ids with the PRD §7
  refusal line. Defaults to room lobby.
---

# Check into / out of the lobby

Canonical phrases:

- **Check into the lobby**
- **Check out of the lobby**

Follow PRD §7. Default room id is **`lobby`**. Rooms are MCP common areas (not Slack, not Grok Bot group chats). Install does not check anyone in.

## Check into the lobby

1. Confirm which assistant id to check in (usually this assistant, or one the user names).
2. That assistant **must** already be on the user's allowlist from `register_assistants`.
3. If it is **not** approved, refuse with **exactly** this line and stop (do not call `check_in`):

   > That assistant is not approved for rooms. Say 'register my assistants for rooms' first.

4. If approved, call `check_in` with `{ "assistant_id": "<id>" }` (omit `room` so it defaults to `lobby`).
5. Confirm from the result (`participant.room_id`, `last_seen`).

## Check out of the lobby

1. Call `check_out` with `{ "assistant_id": "<id>" }`.
2. Confirm checkout.

## Do not

- Invent a room id for these phrases (stay on `lobby` unless the user explicitly names another existing room outside these canonical phrases)
- Auto-register as a side effect of check-in
- Use Slack or any Settings UI
