# Upgrading from v4 to v5

TaskNotes v5 keeps your task files, Base files, and settings. Most of the upgrade happens automatically on first launch. This guide covers what changes, what moves, and what to check afterwards.

!!! tip "Back up first"
    As with any major update, back up your vault before updating, including the hidden `.obsidian` folder. If you want to go back to 4.x later, restore that backup. See [Backup and recovery](guides/backup-recovery.md).

## Requirements

- **Obsidian ${tasknotes.minAppVersion} or later**. Obsidian does not offer TaskNotes v5 to older Obsidian versions.
- **Bases core plugin enabled** (Settings → Core plugins → Bases), as in v4.

If you are upgrading from a release earlier than 4.13.0, HTTP API and MCP clients also need a TaskNotes API token. See [HTTP API authentication](HTTP_API.md#authentication).

## What happens on first launch

1. Your existing `data.json` settings are read and kept. New settings receive their defaults. If TaskNotes cannot read the settings or determine whether the file exists, startup stops rather than saving defaults over it. Resolve the storage or sync error and restart.
2. The HTTP API token moves from `data.json` to Obsidian Secret Storage on that device. The last-seen and last-notified release versions move to per-device storage. These values are removed from `data.json` once they have been stored.
3. If type definitions are turned on, TaskNotes-generated mdbase metadata is upgraded. Updating does not turn type definitions on; they are on by default only for new installs. See [mdbase collections](#mdbase-collections).

Task notes are not rewritten during the upgrade, and existing Base files stay as they are until you run **Update default base files**.

## Synced devices

Update TaskNotes on every device that syncs the vault. TaskNotes 4 and 5 store some settings differently, so running both against the same vault is not supported.

Obsidian Secret Storage is kept on each device and is not synced. After upgrading:

- **HTTP API**: each device that runs the HTTP API has its own token. A device that starts TaskNotes v5 after another device has already removed the token from `data.json` generates a new token and shows a notice. Copy the new token into the API and MCP clients on that device from **Settings → TaskNotes → Advanced**.
- **Calendar accounts**: OAuth credentials and account tokens have been stored in Secret Storage since 4.x. Devices that were not connected before need to be connected separately, as in 4.x.

## Settings are reorganized

Settings now use Obsidian's native settings pages, navigation, and search. Individual settings can be found from Obsidian's settings search. Apart from the [removed settings](#removed-settings), the settings are unchanged; they are grouped differently:

| Page | Contains |
| --- | --- |
| Task files | Task identification, folders, filenames, and frontmatter |
| Properties | Property mappings, statuses, priorities, and custom properties |
| Task creation | Defaults, templates, natural-language input, and form fields |
| Appearance & interaction | Task cards, inline tasks, click behaviour, and view defaults |
| Time & reminders | Notifications, time tracking, recurrence, Pomodoro, and timeblocking |
| Calendars & integrations | Calendar accounts, subscriptions, task export, and interoperability |
| TaskNotes App | TaskNotes App links and setup, and the mdbase integration settings |
| Advanced | Indexing, HTTP API, webhooks, and diagnostics |

See [Settings](settings.md) for details of each page.

### Removed settings

These settings had no effect and are no longer shown:

- **Disable note indexing** (Advanced)
- **Enable fuzzy matching** for project suggestions. The project picker always matches fuzzily.
- **Show due dates when scheduled** and **Show ICS events** under calendar default event visibility. Each calendar view shows or hides each calendar subscription in its own options.
- The views button alignment setting.

**Export v3 saved views to Bases** has also been removed. If you still have TaskNotes v3 saved views, export them in TaskNotes 4.x before upgrading; see [Upgrading from v3 to v4](migration-v3-to-v4.md#converting-saved-filter-views).

Values saved for these settings stay in `data.json`, so devices still on 4.x keep them.

## Interface changes

- **Redesigned views.** Task lists, Kanban boards, calendars, pickers and task dialogs take their spacing, type, colours and controls from Obsidian and your theme. Rows and cards are more compact.
- **Relative dates.** Task cards show dates within a week of today as relative days, such as "Due: Yesterday" or "Scheduled: Monday". The full date appears on hover. To keep absolute dates, choose ISO dates under **Appearance & interaction → Display formatting**.
- **Searchable pickers.** Status, priority, dates, recurrence, reminders and tags open the same searchable picker from task cards, task dialogs and right-click menus. The task right-click menu keeps status, priority, dates, reminders, time tracking, edit, and open at the top level, with other actions under **More**.
- **Undo instead of confirmations.** Deleting a task, note or timeblock happens straight away, and the notice that follows offers **Undo**.
- **Keyboard navigation.** Task List, Kanban and calendar views can be used from the keyboard. Press **?** in a view for the shortcuts. See [Keyboard shortcuts](views.md#keyboard-shortcuts).
- **Calendar.** The Calendar view uses TaskNotes' own calendar engine instead of FullCalendar. Existing calendar settings in `.base` files keep working.
- **Task dialogs.** The create and edit dialogs share one layout. The title is a Markdown editor, and **More fields** shows the less common fields.
- **Natural language input.** Tags, contexts, projects and custom fields are only recognized at the start of the input or after a space, so email addresses and URLs stay intact.
- **Statistics.** The Statistics and Pomodoro statistics dashboards have been removed. The Pomodoro timer, time tracking and recorded history are kept. **Open Pomodoro statistics** now opens a generated Base, `TaskNotes/Views/pomodoro-stats.base`, which totals sessions stored in daily notes. See [Time Management](features/time-management.md#pomodoro-statistics-base).
- **Start Here note.** TaskNotes no longer creates a Start Here note on first install. Open it with the **Open the Start Here guide** command.
- **Kanban swimlanes** can be collapsed from their label. Empty swimlanes start collapsed.
- **Identifying tag.** New vaults hide the identifying task tag on task cards by default. Existing vaults keep their current setting.

## Stable task IDs

New and converted tasks receive a UUID in the `id` frontmatter property. The ID stays the same when a task file is renamed or moved, so integrations can refer to a task without depending on its path.

Existing tasks without an `id` remain valid and are not changed. Path-based integrations continue to work. The JavaScript API adds `getByPath()` and `getById()`; see [JavaScript API](javascript-api.md).

## mdbase collections

This section applies only if type definitions are turned on (**Settings → TaskNotes → TaskNotes App → Turn on type definitions**), which TaskNotes App needs. If they are off, nothing here changes.

With type definitions on, TaskNotes publishes the portable `tasknotes.task` contract used by TaskNotes App and other compatible tools. It is the same contract that TaskNotes App installs, so the plugin and the app can share a collection. Tasks can list assignees as links to person notes; the property is optional.

### mdbase metadata folders

When TaskNotes first creates `mdbase.yaml`, it keeps its types, contracts and schemas under `_mdbase/`, with a README explaining the folder. A vault that already has `mdbase.yaml` keeps its configured folders, and no existing metadata is moved.

**Hide mdbase folders in the file explorer** is on by default under **Settings → TaskNotes → TaskNotes App → Advanced**. Turn it off to browse these folders; their files remain available in search and the quick switcher. See [Integrations](settings/integrations.md).

### TaskNotes settings record

Some TaskNotes behaviour applies to the whole collection, so TaskNotes App can use it too. It is stored in a settings record, `_mdbase/settings/dev.tasknotes.md` (or an existing `_settings/dev.tasknotes.md`). The record holds:

- natural-language capture triggers
- body templates for new tasks and occurrences
- whether archiving moves the file, and where to
- whether completing a task stops its timer
- whether recurring tasks uncheck body checkboxes
- the link format written to frontmatter
- per-status next status, cycle exclusion and auto-archive settings

Everything else, such as property mappings, statuses, priorities and filename rules, stays in the task type.

TaskNotes creates the record when it upgrades or creates a collection, starting from your current settings. Changing one of these settings in TaskNotes writes only that field to the record, and editing the record changes the setting in TaskNotes. If both changed, TaskNotes asks which to keep.

If a sync conflict leaves a second copy of the record, such as `dev.tasknotes (conflicted copy).md`, TaskNotes shows a notice naming it and keeps using the original. Copy any settings you want to keep into the record named in the notice, then delete the copy.

### Metadata upgrade

When the collection's task type was generated by TaskNotes 4.3.2 or later and hasn't been edited, TaskNotes upgrades it to the current format automatically. Collections from the 5.0 betas are upgraded the same way, keeping their settings. The original files are kept under `.tasknotes/migrations/`, and task notes are never rewritten.

If you have edited the task type, or the collection has other types TaskNotes didn't create, TaskNotes leaves them as they are and shows a notice naming the file. Finish syncing all devices and restart Obsidian first, since metadata that is still arriving through sync can look incomplete. If the notice remains, see [mdbase metadata upgrades](guides/backup-recovery.md#mdbase-metadata-upgrades).

### Interrupted updates and blocked collections

The metadata upgrade is backed up and recovered automatically if it is interrupted, for example by closing Obsidian part way through. If recovery finds a file that changed in the meantime, it stops and the notice names the file and backup folder. Keep those files, and see [Interrupted mdbase metadata updates](guides/backup-recovery.md#interrupted-mdbase-metadata-updates).

To avoid conflicts, let syncing finish before you update, and avoid updating on several devices at the same moment, especially on mobile.

### TaskNotes App setup is separate

Turning on type definitions doesn't connect TaskNotes App. The first time TaskNotes App opens the collection, it asks you to approve a one-time **Set up** step, which installs what the app needs. See [Use TaskNotes App with your vault](guides/tasknotes-app.md).

That setup writes the task type whether or not type definitions are turned on in the plugin. Update TaskNotes to version 5 on every device that uses the vault first: a device still running TaskNotes 4 with **Generate mdbase type definitions** turned on can overwrite the type.

### Check existing task records

The upgrade never changes your task notes, so some older tasks may not match the task type. For example, a tag-identified task may be missing a creation date, or use a status that isn't configured. Run **TaskNotes: Check collection** from the command palette after upgrading:

1. Review the listed tasks and their errors. Checking alone changes no notes.
2. For missing creation dates, **Back up and fix** offers the file's creation time. Check that time in the confirmation; copying files between devices can change file creation times.
3. For invalid statuses, choose a replacement for each task. TaskNotes doesn't guess a replacement.
4. Confirm the listed changes. Each original note is backed up to `.tasknotes/migrations/` first, and a note that changed since the check is left alone. Cancel keeps every note unchanged.
5. Check again to confirm the results. Other errors need to be fixed by hand.

The check requires type definitions to be turned on. For more detail on how it decides which notes to check, see [mdbase metadata upgrades](guides/backup-recovery.md#mdbase-metadata-upgrades).

## Returning to v4

To return to TaskNotes 4.x, restore the backup you made before upgrading. If you downgrade without restoring:

- 4.x no longer finds the HTTP API token in `data.json` and generates a new one when the API starts. Update your clients.
- 4.x no longer finds its last-seen version in `data.json`, so it treats the vault as a new install and may create the TaskNotes starter note. You can delete that note.
- If an mdbase upgrade ran, restore `mdbase.yaml` and the task type from `.tasknotes/migrations/`.

## Getting help

If something does not look right after upgrading, see [Troubleshooting](troubleshooting.md) or [report the problem](https://github.com/callumalpass/tasknotes/issues) with the output of Obsidian's **Show debug info** command.
