---
description: Back up, restore, reset, and uninstall TaskNotes while protecting task notes, views, settings, and integration data.
---

# Backup, restore, and removal

TaskNotes keeps task content in your vault and configuration in the plugin data file. A complete backup includes both.

## What to back up

| Data | Typical location | Why it matters |
| --- | --- | --- |
| Task notes | Your configured task folders | Titles, properties, details, recurrence, and time entries |
| Base views | `TaskNotes/Views/` or custom paths | Filters, formulas, layout, and custom views |
| Plugin settings | `.obsidian/plugins/tasknotes/data.json` | Field mapping, statuses, defaults, integrations, and view command paths |
| Daily notes | Your daily-note folder | Pomodoro history when daily-note storage is enabled |
| mdbase configuration | `tasknotes.yaml`, `mdbase.yaml`, or `.mdbase/` when configured | Shared collection and schema configuration |

Treat `data.json` as sensitive because integration configuration can include credentials or tokens. Store backups accordingly.

## Create a restorable backup

1. Close Obsidian or disable TaskNotes so settings are not being written.
2. Copy the entire vault, including hidden files.
3. Verify the backup contains `.obsidian/plugins/tasknotes/data.json`.
4. Keep at least one version from before a migration or bulk edit.

File-history sync is useful, but it is not a substitute for a separate tested backup.

## Restore

1. Close Obsidian.
2. Restore task notes and Base files first.
3. Restore `.obsidian/plugins/tasknotes/data.json` if you also need the previous settings.
4. Reopen Obsidian and confirm Bases is enabled.
5. Run **TaskNotes: Refresh cache** and open one default Base.

If provider credentials have expired or were intentionally excluded from the backup, reconnect those integrations instead of restoring stale tokens.

## Reset configuration safely

Do not delete `data.json` as a first troubleshooting step.

1. Close Obsidian.
2. Rename `data.json` to `data.json.backup-YYYY-MM-DD`.
3. Reopen Obsidian and test with fresh defaults.
4. Restore the backup while Obsidian is closed if the reset does not help.

A reset affects settings, configured statuses and priorities, integration state, saved views, and plugin-stored Pomodoro history. It does not delete task Markdown files.

## Uninstall

Disabling or uninstalling TaskNotes leaves task notes and `.base` files in the vault. After uninstalling, remove generated folders only if you have inspected them and confirmed they contain no content you want to keep.

To remove plugin settings as well, close Obsidian and remove `.obsidian/plugins/tasknotes/` after making a backup. Task metadata remains readable YAML, but TaskNotes-specific Base view types and interactive widgets will no longer render.

## Recovery checklist

- Missing tasks: restore the note files, then verify task identification and excluded folders.
- Missing settings: restore `data.json` with Obsidian closed.
- Broken default views: regenerate them from **General → Views & base files**.
- Broken custom views: restore the individual `.base` files from history.
- Lost Pomodoro history: restore the configured storage source, which may be plugin data or daily-note frontmatter.
