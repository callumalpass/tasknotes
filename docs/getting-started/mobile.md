---
description: What is shared between TaskNotes desktop and mobile, and which integrations differ on mobile.
---

# Mobile guide

TaskNotes task files, Base files, settings, and most commands work on Obsidian mobile. Sync the complete vault, including `.base` files and `.obsidian/plugins/tasknotes/data.json`, when you want the same configuration on every device.

## Before opening TaskNotes

1. Install an Obsidian mobile version compatible with the current [TaskNotes requirement](../reference/compatibility.md).
2. Enable the **Bases** core plugin.
3. Confirm the TaskNotes plugin and its `data.json` have finished syncing before changing settings.
4. Open a small default Base first and allow the initial index to finish.

## Mobile differences

| Area | Mobile behavior |
| --- | --- |
| HTTP API and MCP server | Desktop only. The HTTP API settings section is hidden on mobile. |
| Calendar integrations | Available, with an option to disable calendar integration on mobile when startup time or provider behavior is a problem. |
| Settings layout | Uses the same six tabs. Desktop-only controls are omitted where they cannot run. |
| Keyboard commands | Commands remain available in the command palette; desktop key bindings may not have a mobile equivalent. |
| Wide views | Calendar, Kanban, and large tables may require horizontal scrolling or a narrower Base configuration. |

## A practical mobile setup

- Keep task cards compact under **Settings → Appearance and UI**.
- Limit visible Base columns and calendar event layers.
- Increase remote calendar refresh intervals when mobile networking or battery use matters.
- Use the task creation modal or command palette for predictable capture.
- Keep HTTP automation on a desktop Obsidian instance.

## If mobile stops loading tasks

Wait for vault sync to finish, confirm Bases is enabled, and run **TaskNotes: Refresh cache**. Then reopen the affected Base. If the problem is isolated to calendar data, enable **Disable calendar integration on mobile** and restart Obsidian before investigating the provider connection on desktop.
