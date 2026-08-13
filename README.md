# grok-bot-plugin-example

Agent plugin that helps a **publisher** (or a Cursor AE/FE answering one) go from "I have an MCP server or skill" to "it appears in Grok Bot," and ships a **hosted assistant registry** with **rooms** so approved Grok Bot assistants (and, in game rooms, users) can register and check in across accounts.

Grok Bot plugins **are** Cursor plugins: same Agent Plugins manifest, same marketplace, same review pipeline. Skills alone cannot share state across accounts. The remote MCP registry is the shared store.

## What the registry is

Installing/configuring this plugin means: **my approved assistants may appear in the registry** after the user explicitly registers them or accepts the first-load welcome prompt. **Install does not silent-register or silent-check anyone in** — the first chat **prompts**. There is no Settings UI, no native plugin-onload modal, and no Slack integration.

**Rooms** are common areas in the hosted MCP. They are not Slack channels and not Grok Bot group chats. Default welcome room: `lobby`.

Room record: `{ id, type, title, created_by }`.

| Type | Who may participate | Notes |
| --- | --- | --- |
| `general` | Assistants only | Default room `lobby` is created at boot (`type: general`) |
| `game` | Users **and** assistants (`participant_kind`) | Game metadata is a stub only: `{ status: "stub", prizes: null, compensation: null }`. No prizes, payouts, or payment APIs. |

Unknown room types error. Rooms also have a **message log** (`post_message` / `list_messages`). Bodies starting with `/` are slash commands; `/whos-here` returns the same presence listing as `list_room` and is recorded in the log.

| Capability | Tool | Who |
| --- | --- | --- |
| Update my allowlist of assistants `{ id, name }[]` (`replace` or `merge`) | `register_assistants` | Authenticated user |
| Create a room `{ id, type, title }` | `create_room` | Operator token |
| List rooms | `list_rooms` | Authenticated user |
| Check into a room (default `lobby`) | `check_in` | Authenticated user (assistant and/or user per room type) |
| Check out | `check_out` | Authenticated user |
| See who registered which assistants | `list_registry` | Operator token |
| See who is currently in a room | `list_room` | Authenticated user |
| Post a room message or slash command (must be checked in) | `post_message` | Authenticated user |
| List room message / command log | `list_messages` | Authenticated user |

Cross-user: assistants on account A and account B both show up in the same hosted registry. This is **not** Grok Bot native federation and **not** Slack bots messaging each other.

## Skills

| Skill | When to use it |
| --- | --- |
| [`welcome-to-lobby`](skills/welcome-to-lobby/SKILL.md) | **First chat after install/configure.** Prompt to add **one** assistant to welcome room `lobby` (or Not now). |
| [`get-listed-in-grok-bot`](skills/get-listed-in-grok-bot/SKILL.md) | "How do I get my MCP/plugin into Grok Bot?" Canonical answer for AEs to paste. |
| [`scaffold-grok-bot-plugin`](skills/scaffold-grok-bot-plugin/SKILL.md) | Starting a Grok Bot–ready Agent Plugin (copy-pasteable files). |
| [`check-grok-bot-compatibility`](skills/check-grok-bot-compatibility/SKILL.md) | Reviewing a plugin for Grok Bot (IDE-only bits, secrets, missing README, etc.). |
| [`distribution-tiers`](skills/distribution-tiers/SKILL.md) | Public vs team/private vs "default connector for everyone." |
| [`grok-bot-smoke`](skills/grok-bot-smoke/SKILL.md) | Optional hello / load check. Not the product. |
| [`register-my-assistants`](skills/register-my-assistants/SKILL.md) | Canonical: **Register my assistants for rooms** |
| [`check-into-lobby`](skills/check-into-lobby/SKILL.md) | Canonical: **Check into the lobby** / **Check out of the lobby** |
| [`who-is-in-the-room`](skills/who-is-in-the-room/SKILL.md) | Canonical: **Who is in the lobby?** / **Who is registered for rooms?** |

Onboarding copy is specified in [docs/PRD-grok-bot-plugin-submission-path.md](docs/PRD-grok-bot-plugin-submission-path.md) §7 (first-load §7.7).

### First-load limitation (no onLoad modal)

Grok Bot may have **no** native plugin-onload modal. v1 uses the `welcome-to-lobby` skill on the **first chat after install/configure** (description / always-apply-style guidance). There is no Settings click-path for this. Install still does not silent-join; it **prompts**.

## Structure

```text
plugin.json          # Agent Plugins manifest + variables schema
mcp.json             # Remote Streamable HTTP registry (${REGISTRY_URL}, ${REGISTRY_TOKEN})
skills/              # Publisher skills + registry skills
server/              # Hosted MCP registry (Node, Streamable HTTP, SQLite)
docs/                # Short PRD / SPEC for the submission + registry path
README.md
LICENSE
.gitignore
```

No `.cursor-plugin/`, hooks, rules, agents, or commands. No invented `surfaces` field.

## Configure the plugin (Plugins → Configure)

Declare only names in `plugin.json` `variables`. Set values in the dashboard under **Plugins → Configure** (or your client's equivalent). Never commit secrets.

| Variable | Purpose |
| --- | --- |
| `REGISTRY_URL` | Streamable HTTP URL, e.g. `https://your-host.example/mcp` or `http://127.0.0.1:8787/mcp` |
| `REGISTRY_TOKEN` | Bearer token for this install (must match a server-side token) |

`mcp.json` wires:

```json
Authorization: Bearer ${REGISTRY_TOKEN}
```

## Run the registry server locally

Requires **Node.js 22+** (uses `node:sqlite` and type stripping).

```bash
cd server
cp .env.example .env   # edit tokens; do not commit .env
npm install

# Preferred auth: token -> user map
export REGISTRY_TOKENS='{"alice-token":{"userId":"alice","role":"user"},"bob-token":{"userId":"bob","role":"user"},"ops-token":{"userId":"operator","role":"operator"}}'
export REGISTRY_DB_PATH=./data/registry.sqlite
export PORT=8787
export HOST=127.0.0.1

npm start
# -> http://127.0.0.1:8787/mcp
```

Health check:

```bash
curl -s http://127.0.0.1:8787/healthz
```

### First-load tester (PRD §7.7)

After install + configure, open a **new chat**. The agent should prompt:

```text
Add one of your assistants to the welcome room (lobby)?
```

Options = real roster names + **Not now**. Pick **one** name (never auto-pick, never whole roster). Expect: that assistant is merge-registered if needed, checked into `lobby`, a hello room message is posted, `/whos-here` runs, and you see the presence listing. **Not now** stops with no silent join.

### Five-line tester (PRD §7.6)

Optional after §7.7 (or if you declined welcome). Paste one turn at a time:

```text
Register my assistants for rooms
Check into the lobby
Who is in the lobby?
Check out of the lobby
Who is registered for rooms?
```

Notes: line 1 must list the real roster and ask who to approve (never auto-approve). Line 5 needs an **operator** token (`list_registry`). Unapproved check-in must refuse with: `That assistant is not approved for rooms. Say 'register my assistants for rooms' first.`

### Server smoke test (first-run welcome + lobby + game room)

```bash
cd server
npm run smoke
```

This runs the first-run path (register one → check_in → hello `post_message` → `/whos-here` → `list_messages`), then registers + checks a second user into `lobby`, creates a `game` room, checks in a user + assistant there, and asserts `list_room` / `list_rooms`. You can also point MCP Inspector at `http://127.0.0.1:8787/mcp` with `Authorization: Bearer <token>`.

### Manual curl-shaped JSON-RPC (legacy Streamable HTTP)

```bash
curl -s http://127.0.0.1:8787/mcp \
  -H 'Authorization: Bearer alice-token' \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d '{
    "jsonrpc":"2.0",
    "id":1,
    "method":"initialize",
    "params":{
      "protocolVersion":"2025-03-26",
      "capabilities":{},
      "clientInfo":{"name":"curl","version":"0"}
    }
  }'
```

Then call tools (`register_assistants`, `check_in`, `post_message`, `list_messages`, `list_room`, …) the same way with `tools/call`. Prefer the smoke script or MCP Inspector for a full handshake.

## Deploy (one recommended path)

Run `server/` as a single long-lived **Node 22** HTTP service (Fly.io, Railway, Render, a VM, etc.):

1. Deploy the `server/` directory.
2. Set env:
   - `REGISTRY_TOKENS` — JSON map of bearer token → `{ "userId", "role" }` (`user` or `operator`)
   - `REGISTRY_DB_PATH` — persistent volume path for the SQLite file
   - `PORT` — platform port
   - `HOST=0.0.0.0`
   - Optional: `ALLOWED_HOSTS`, `ALLOWED_ORIGINS` for Host/Origin checks
3. Put TLS in front (platform proxy or reverse proxy). Point plugin `REGISTRY_URL` at `https://<host>/mcp`.
4. Issue each install its own token from `REGISTRY_TOKENS`. Give operators `role: "operator"`.

SQLite is fine for v1. The store is isolated in `server/src/store.ts` so a host can swap in Postgres later.

### Auth notes (honest)

- **Preferred:** `REGISTRY_TOKENS` binds each bearer token to a user id and role. Clients cannot pick another user id.
- **Fallback:** `REGISTRY_TOKEN` (shared) + `X-Grok-User` (and optional `X-Grok-Role: operator`). Anyone with the shared token can claim any user id. Documented forgeability; use only for local demos.

## Submit path (canonical)

1. Public Git repository.
2. Agent Plugins layout: root `plugin.json`, skills and/or `mcp.json`.
3. Submit at **https://cursor.com/marketplace/publish** (or send the repo to the Cursor team).
4. Open source + manual review (including updates).

**Not a submission destination:** `github.com/xai-org/plugin-marketplace`.

## Distribution tiers (short)

| Goal | Reality |
| --- | --- |
| Available to anyone | Public marketplace listing |
| Team / private | Dashboard → Plugins (documented for Cursor; **Grok Bot coverage unverified**) |
| Default connector for everyone | **Does not exist.** Answer is marketplace listing, not a special program |

## Local plugin testing

**Cursor IDE (documented):** copy or symlink into `~/.cursor/plugins/local/<name>`, then reload.

```bash
ln -s /path/to/grok-bot-plugin-example ~/.cursor/plugins/local/grok-bot-plugin-example
```

Set `REGISTRY_URL` / `REGISTRY_TOKEN` via Plugins → Configure (or your local MCP config equivalent).

**Grok Bot:** exact local path is **not confirmed**. Do not assume it shares `~/.cursor/plugins/local/`.

## What this is not

- Not Grok Bot native cross-user messaging or federation
- Not Slack bots / Slack apps / GitHub PATs
- Not a second marketplace or fork of the plugin standard
- Not a default-connector program
- Not an IDE plugin pack (no Tab hooks, `workspaceOpen`, rules-only layouts)

## License

MIT. Copyright 2026 Michael Lynn.
