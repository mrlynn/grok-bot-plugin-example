---
name: register-my-assistants
description: >-
  Onboarding for rooms. Use when the user says "Register my assistants for rooms"
  (canonical) or asks which assistants are approved for the hosted registry.
  Lists the real roster, asks who to approve (never auto-approve), calls
  register_assistants (replaces allowlist), then offers lobby check-in and stops
  if they decline. Install alone must not register anyone.
---

# Register my assistants for rooms

Canonical phrase: **Register my assistants for rooms**

Follow PRD §7. Installing or configuring the plugin does **not** register assistants and does **not** check anyone in. No Settings UI. No Slack.

## Flow (required order)

1. **List the real roster**  
   Enumerate this user's actual Grok Bot assistants (ids + names) from client/account context. If you cannot see a roster, ask the user to name them. Never invent assistants. Never assume "everyone."

2. **Ask who to approve**  
   Present the list and ask which ones should be approved for rooms.  
   **Never auto-approve everyone** on install, first run, or because the list is short.

3. **Replace the allowlist**  
   After the user picks, call `register_assistants` with only that set as `{ id, name }[]`.  
   The tool **REPLACES** this user's previous allowlist (it does not merge).

4. **Offer lobby check-in, then stop if declined**  
   Ask whether they want to **Check into the lobby** now (for one approved assistant).  
   - If yes → hand off to the check-into-lobby flow / `check_in` for `lobby`.  
   - If no → acknowledge and **stop**. Do not check in anyway.

## Do not

- Register on install
- Auto-approve the full roster
- Check into a room unless the user accepts the offer (or separately says "Check into the lobby")
- Claim this messages other users' assistants natively
