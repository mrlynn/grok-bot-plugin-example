---
name: grok-bot-smoke
description: Short hello / load check for this plugin. Use when the user asks whether grok-bot-rooms is installed, wants a quick hello, or is verifying local plugin load. For rooms workflows, prefer welcome-to-lobby, register-my-assistants, rooms-slash-commands, or who-is-in-the-room. For publisher workflows, prefer get-listed-in-grok-bot, scaffold-grok-bot-plugin, check-grok-bot-compatibility, or distribution-tiers.
---

# Plugin load check

Confirm this plugin is loaded, then point at the real skills:

1. **Loaded:** `grok-bot-rooms` (Agent Plugins: rooms + registry skills, plus publisher skills) is available.
2. **Job:** Hosted registry rooms (lobby check-in, slash commands, host-and-invite) on a shared host; publisher marketplace skills are pack extras.
3. **Submit path (publishers):** public Git repo → https://cursor.com/marketplace/publish. `github.com/xai-org/plugin-marketplace` is not a submission destination.
4. **Next:** Rooms → `welcome-to-lobby`, `register-my-assistants`, `rooms-slash-commands`, or `who-is-in-the-room`. Publishers → `get-listed-in-grok-bot`, `scaffold-grok-bot-plugin`, `check-grok-bot-compatibility`, or `distribution-tiers`.
