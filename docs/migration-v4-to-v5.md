# Upgrading from v4 to v5

TaskNotes v5 keeps your task files, Base files, and settings. Most of the upgrade happens automatically on first launch. This guide covers what changes, what moves, and what to check afterwards.

!!! warning "Back up before upgrading"
    Back up the complete vault, including the hidden `.obsidian` directory, before upgrading. See [Backup and recovery](guides/backup-recovery.md).

## Requirements

- **Obsidian ${tasknotes.minAppVersion} or later**. Obsidian does not offer TaskNotes v5 to older Obsidian versions.
- **Bases core plugin enabled** (Settings → Core plugins → Bases), as in v4.

If you are upgrading from a release earlier than 4.13.0, HTTP API and MCP clients also need a TaskNotes API token. See [HTTP API authentication](HTTP_API.md#authentication).

## What happens on first launch

1. Your existing `data.json` settings are read and kept. New settings receive their defaults.
2. The HTTP API token moves from `data.json` to Obsidian Secret Storage on that device. The last-seen and last-notified release versions move to per-device storage. These values are removed from `data.json` once they have been stored.
3. If the mdbase integration is enabled, TaskNotes-generated mdbase v0.2 metadata is upgraded to v0.3. See [mdbase collections](#mdbase-collections).

Task notes are not rewritten during the upgrade.

## Synced devices

Upgrade every device that syncs the vault. Running v4 and v5 against the same `data.json` is not supported.

Obsidian Secret Storage is kept on each device and is not synced. After upgrading:

- **HTTP API**: each device that runs the HTTP API has its own token. A device that starts TaskNotes v5 after another device has already removed the token from `data.json` generates a new token and shows a notice. Copy the new token into the API and MCP clients on that device from **Settings → TaskNotes → Advanced**.
- **Calendar accounts**: OAuth credentials and account tokens have been stored in Secret Storage since 4.x. Devices that were not connected before need to be connected separately, as in 4.x.

## Settings are reorganized

Settings now use Obsidian's native settings pages, navigation, and search. Individual settings can be found from Obsidian's settings search. The settings themselves are unchanged; they are grouped differently:

| Page | Contains |
| --- | --- |
| Task files | Task identification, folders, filenames, and frontmatter |
| Properties | Property mappings, statuses, priorities, and custom properties |
| Task creation | Defaults, templates, natural-language input, and form fields |
| Appearance & interaction | Task cards, inline tasks, click behaviour, and view defaults |
| Time & reminders | Notifications, time tracking, recurrence, Pomodoro, and timeblocking |
| Calendars & integrations | Calendar accounts, subscriptions, task export, and interoperability |
| Advanced | Indexing, HTTP API, webhooks, and diagnostics |

See [Settings](settings.md) for details of each page.

## Stable task IDs

New and converted tasks receive a UUID in the `id` frontmatter property. The ID stays the same when a task file is renamed or moved, so integrations can refer to a task without depending on its path.

Existing tasks without an `id` remain valid and are not changed. Path-based integrations continue to work. The JavaScript API adds `getByPath()` and `getById()`; see [JavaScript API](javascript-api.md).

## mdbase collections

If the [mdbase integration](settings/integrations.md#mdbase) is enabled, TaskNotes v5 publishes the portable `tasknotes.task` contract used by TaskNotes App and other compatible tools.

When the collection's only active type is an unmodified TaskNotes-generated v0.2 type, TaskNotes upgrades the metadata to mdbase v0.3 automatically. The previous `mdbase.yaml` and task type are kept under `.tasknotes/migrations/`. Collections with additional, modified, or hand-maintained types are left unchanged for you to review.

If the integration is not enabled, nothing changes.

## Interface changes

- Task cards show dates within a week of today as relative days, such as "Due: Yesterday" or "Scheduled: Monday". The full date appears on hover. To keep absolute dates, choose ISO dates under **Appearance & interaction → Display formatting**.
- The task context menu keeps status, priority, dates, reminders, time tracking, edit, and open at the top level. Other actions are under **More**.
- Kanban swimlanes can be collapsed from their label. Empty swimlanes start collapsed.
- New vaults hide the identifying task tag on task cards by default. Existing vaults keep their current setting.

## Returning to v4

To return to TaskNotes 4.x, restore the backup you made before upgrading. If you downgrade without restoring:

- 4.x no longer finds the HTTP API token in `data.json` and generates a new one when the API starts. Update your clients.
- 4.x no longer finds its last-seen version in `data.json`, so it treats the vault as a new install and may create the TaskNotes starter note. You can delete that note.
- If an mdbase upgrade ran, restore `mdbase.yaml` and the task type from `.tasknotes/migrations/`.

## Getting help

If something does not look right after upgrading, see [Troubleshooting](troubleshooting.md) or [report the problem](https://github.com/callumalpass/tasknotes/issues) with the output of Obsidian's **Show debug info** command.
