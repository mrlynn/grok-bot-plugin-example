---
name: register-my-assistants
description: Register the user's approved Grok Bot assistants into the shared hosted registry allowlist. Use after the plugin is installed/configured, or when the user says which assistants are approved for the registry. Calls register_assistants; does not check anyone into a room.
---

# Register my assistants

Use the **grok-bot-registry** MCP tools. This is the cross-user allowlist store. Skills alone cannot share assistants across accounts.

## When to run

- Right after install / variables are configured (`REGISTRY_URL`, `REGISTRY_TOKEN`)
- When the user names which assistants are approved to appear in the registry
- When the user wants to replace their previous allowlist

## Steps

1. Confirm the user intends to **replace** their entire allowlist (the tool replaces, it does not merge).
2. Collect `{ id, name }[]` for each approved assistant. Prefer stable ids the user already uses.
3. Call `register_assistants` with that array.
4. Tell the user registration succeeded and that assistants are **not** checked in yet. Point them at `check-into-lobby` / `check_in` when they want presence in room `lobby`.

## Do not

- Invent assistant ids the user did not approve
- Claim this messages other users' assistants natively (it only updates the shared registry)
- Check assistants into a room unless the user asked for presence
