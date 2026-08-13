---
name: who-is-in-the-room
description: >-
  Lobby and registration visibility. Use when the user says "Who is in the
  lobby?" (list_room lobby) or "Who is registered for rooms?" (list_registry,
  operator-token only). For slash commands /rooms, /whos-here, /who, /join, /leave,
  prefer rooms-slash-commands — those are hard registry room commands even in
  1:1 chat, not roster questions. Follow PRD §7. No Slack. No Settings UI.
---

# Who is in the lobby? / Who is registered for rooms?

Canonical phrases:

- **Who is in the lobby?**
- **Who is registered for rooms?**

Follow PRD §7. Cross-user visibility comes from the hosted **grok-bot-registry** MCP only. Install does not silent-register anyone; first chat may prompt via `welcome-to-lobby`.

## Who is in the lobby?

1. Call `list_room` for **`lobby`** (pass `room: "lobby"` or rely on the default).  
   Equivalent room slash command (when already checked in): `post_message` with body `/whos-here` or `/who` — same participant listing, also recorded in the room log.  
   If the user typed `/rooms`, `/whos-here`, `/who`, `/join`, or `/leave` literally, follow `rooms-slash-commands` instead of treating it as a roster question.
2. Summarize participants: `participant_kind`, `user_id`, `assistant_id`, `display_name`, `last_seen`.
3. Keep it factual. Do not imply private messaging between accounts.

## Who is registered for rooms?

1. Call `list_registry`. This is **operator-token only**.
2. If the tool returns forbidden / not operator, say the caller needs an operator token. Do not invent a registry list.
3. If it succeeds, summarize registered users and their approved assistants.

## Do not

- Use Slack
- Point at a Settings UI (there is none)
- Treat install as having silent-registered anyone (first-load **prompts** only)
- For the lobby phrase, do not expand into other rooms unless the user asks beyond the canonical line
