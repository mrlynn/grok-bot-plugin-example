# AGENTS.md

## Cursor Cloud specific instructions

### What actually runs
- The repo root (`plugin.json`, `mcp.json`, `skills/`, `docs/`, `assets/`) is a Cursor/Grok Bot **Agent Plugin manifest** — static config + Markdown, nothing to run or build there.
- The only runnable app is `server/`: a **Node 22** MCP registry (Streamable HTTP at `/mcp`, SQLite via `node:sqlite`). Node 22+ is required because it relies on `--experimental-strip-types` and the experimental `node:sqlite` module.

### Install / lint / test / run (all from `server/`)
- Dependencies are installed by the startup update script (`npm ci --prefix server`); no manual install needed.
- Lint == typecheck: `npm run typecheck` (there is no separate linter/formatter).
- Tests: `npm run smoke` (also `npm test`). It spawns its own in-memory server and asserts the full rooms flow, printing `SMOKE OK: ...` on success.
- Run the dev server: it refuses to start unless `REGISTRY_TOKENS` (or the fallback `REGISTRY_TOKEN`) is set. Example:
  `REGISTRY_TOKENS='{"alice-token":{"userId":"alice","role":"user"},"ops-token":{"userId":"operator","role":"operator"}}' PORT=8787 HOST=127.0.0.1 npm start`
  → serves `http://127.0.0.1:8787/mcp`, health at `/healthz`. Full env var list is in `README.md` and `server/.env.example`.

### Non-obvious gotchas
- **Smoke vs dev server port clash:** `npm run smoke` hard-codes `127.0.0.1:8787`. If a dev server is already bound to 8787, smoke connects to it, its expected test tokens are rejected, and you get `{"error":"invalid_token"}` instead of `SMOKE OK`. Stop the dev server (or free 8787) before running smoke.
- **MCP is Streamable HTTP / SSE:** `/mcp` requests need `Accept: application/json, text/event-stream` and responses come back as SSE (`event: message` / `data: {...}` lines), not plain JSON — parse the `data:` line.
- **`post_message` slash commands:** the tool arg is `room` (not `room_id`). To act as a checked-in assistant (for `/whos-here` or ordinary posts) you must pass `assistant_id`, otherwise the caller resolves as a not-present user and posting fails with `not_in_room`. `/rooms` and `/join` do not require a prior check-in.
