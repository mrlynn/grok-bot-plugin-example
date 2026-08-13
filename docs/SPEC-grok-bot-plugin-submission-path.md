# SPEC: Grok Bot plugin + hosted registry (v1)

## Surfaces

- Agent Plugins package: `plugin.json`, `mcp.json`, skills (no IDE-only components).
- Hosted MCP registry (Streamable HTTP) is the cross-user store.

## Auth

- Preferred: `REGISTRY_TOKENS` JSON map → `{ userId, role: "user"|"operator" }`.
- Fallback: shared `REGISTRY_TOKEN` + `X-Grok-User` (forgeable; demos only).

## Rooms

```ts
type Room = {
  id: string;
  type: 'general' | 'game';
  title: string;
  created_by: string;
};
```

- Unknown `type` → error.
- Boot seed: `{ id: "lobby", type: "general", title: "Lobby", created_by: "system" }`.
- Rooms are MCP common areas (not Slack, not Grok Bot chats).

## Participants

```ts
type Participant = {
  participant_kind: 'user' | 'assistant';
  user_id: string;
  assistant_id: string | null;
  display_name: string;
  room_id: string;
  checked_in_at: string;
  last_seen: string;
};
```

| Room type | Allowed participants |
| --- | --- |
| `general` | `assistant` only |
| `game` | `user` and `assistant` |

A participant is in at most one room at a time (check-in moves them).

## Game metadata (stub only)

```json
{ "status": "stub", "prizes": null, "compensation": null }
```

No prizes, payouts, compensation, or payment APIs in v1.

## Tools

| Tool | Auth | Notes |
| --- | --- | --- |
| `register_assistants` | user | Replace allowlist; no check-in |
| `create_room` | operator | `{ id, type, title }` |
| `list_rooms` | user | All rooms |
| `check_in` | user | Default room `lobby`; assistant requires allowlisted `assistant_id`; user only in `game` |
| `check_out` | user | By assistant or user kind |
| `list_registry` | operator | Registered users + assistants |
| `list_room` | user | Default `lobby`; includes room + participants + game stub when applicable |

## Onboarding (skills) — see PRD §7

Canonical phrases: `Register my assistants for rooms`, `Check into the lobby`, `Check out of the lobby`, `Who is in the lobby?`, `Who is registered for rooms?`

- Install does not register or check in
- `register_assistants` replaces allowlist after explicit approval (never auto-approve everyone)
- Unapproved check-in refusal (exact): `That assistant is not approved for rooms. Say 'register my assistants for rooms' first.`
- `list_registry` is operator-token only
- No Settings UI, no Slack

## Non-goals

- Slack bots / Slack apps / GitHub PATs
- Settings UI for roster approval
- Auto-register / auto-check-in on install
- Grok Bot native federation or cross-user messaging
- Payment / prize engines
