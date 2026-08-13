---
name: distribution-tiers
description: Explain public marketplace vs team/private vs "default connector for everyone." Use when a publisher or AE/FE asks how to make a connector available to anyone, only to their team, or installed by default for all Grok Bot users. Be explicit that a default/bundled connector program does not exist.
---

# Distribution tiers

Answer with these **three rows**. Do not invent a fourth path or a request form.

## Tier table

| Goal | What exists | What to do |
| --- | --- | --- |
| **Available to anyone** (public) | **Yes** — Cursor marketplace | Public Git repo → https://cursor.com/marketplace/publish. Open source, manual review (including updates). Same listing is what Cursor IDE, CLI, and Grok Bot share today. |
| **Team / private only** | **Yes for Cursor** — Dashboard → Plugins (team marketplace). **Grok Bot coverage unverified** | Admin adds/imports a team marketplace from Dashboard → Plugins. Documented for Agent Window, IDE, and CLI. Say clearly: Grok Bot coverage is **not confirmed**; do not promise private team plugins appear in Grok Bot until verified on the client. |
| **Default / bundled for everyone** | **Does not exist** as a process | There is **no** default-connector program and **no** request form for "make this the default connector for all users." The way to make a connector available to anyone is a **public marketplace listing**, not a special bundling track. Legacy hardcoded plugins are a **client** problem, not something this plugin can change. |

## Phrases to use

- Public: "Submit the public repo at cursor.com/marketplace/publish."
- Team: "Use Dashboard → Plugins for a private team marketplace. That is documented for Cursor surfaces; Grok Bot coverage is unverified."
- Default: "There is no default-connector path. List it on the public marketplace if you want anyone to install it."

## Phrases to avoid

- "File a request to become a default connector."
- "Open a PR on github.com/xai-org/plugin-marketplace."
- "Add `"surfaces": ["grok-bot"]` to the manifest." (not shipped)
- "Team marketplace definitely works in Grok Bot." (unverified)

## Misconception: xai-org marketplace

`github.com/xai-org/plugin-marketplace` is **not** a submission destination and **not** a default-connector intake. Redirect to `cursor.com/marketplace/publish`.

## Related

- Submit steps → `get-listed-in-grok-bot`
- Build the repo → `scaffold-grok-bot-plugin`
- Pre-submit review → `check-grok-bot-compatibility`
