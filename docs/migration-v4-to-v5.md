# Upgrading from v4 to v5

TaskNotes v5 keeps your task files, Base files, and settings. Most of the upgrade happens automatically on first launch. This guide covers what changes, what moves, and what to check afterwards.

!!! warning "Back up before upgrading"
    Back up the complete vault, including the hidden `.obsidian` directory, before upgrading. See [Backup and recovery](guides/backup-recovery.md).

## Requirements

- **Obsidian ${tasknotes.minAppVersion} or later**. Obsidian does not offer TaskNotes v5 to older Obsidian versions.
- **Bases core plugin enabled** (Settings → Core plugins → Bases), as in v4.

If you are upgrading from a release earlier than 4.13.0, HTTP API and MCP clients also need a TaskNotes API token. See [HTTP API authentication](HTTP_API.md#authentication).

## What happens on first launch

1. Your existing `data.json` settings are read and kept. New settings receive their defaults. If TaskNotes cannot read the settings or determine whether the file exists, startup stops rather than saving defaults over it. Resolve the storage or sync error and restart.
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

If the [mdbase integration](settings/integrations.md#mdbase) is enabled, TaskNotes v5 publishes the portable `tasknotes.task` contract (version 0.3.0-rc.5) used by TaskNotes App and other compatible tools. It is the same contract, byte for byte, that TaskNotes App installs, so the plugin and the app can share a collection. Tasks can list assignees as links to person notes; the property is optional.

When the collection's only active type is an unmodified TaskNotes-generated v0.2 type, TaskNotes upgrades the metadata to mdbase v0.3 automatically. Generated formats from 4.3.2 through 4.13.7 are recognized using their historical writers and your saved settings, including BOM/CRLF formatting and reordered YAML mapping keys. Exact historical output containing v4's invalid unquoted status values can also be regenerated safely from those settings. The original bytes of `mdbase.yaml` and the task type are kept under `.tasknotes/migrations/`; task notes are never rewritten.

If v4 added its generated task type to an existing v0.3 collection, TaskNotes upgrades that file in place and preserves foreign types and configuration instead of creating an overlapping task type.

Incomplete synced metadata is not treated as a new collection. If type or support files arrive before `mdbase.yaml`, TaskNotes waits without creating another type. The upgrade retries when the configuration or task type arrives. Finish syncing all metadata before diagnosing a blocked upgrade.

Additional v0.2 types or genuinely edited task/support definitions are preserved for review. The notice names the affected file. Back up the vault, finish syncing and restart first. If still blocked, restore the unmodified generated type **and matching saved settings** from a known-good backup, or use mdbase to migrate a separate copy and review all type definitions before replacing the active metadata. Do not delete a user-maintained type merely to make ownership recognition succeed. Known generated support resources tolerate line-ending changes; custom commentary or schema edits are not silently overwritten.

If you used a 5.0 beta, TaskNotes updates its task type to the current contract when the vault opens and tells you once. The previous type is backed up under `.tasknotes/migrations/`. The upgrade keeps existing property-role mappings (including custom stable IDs), binding policies, archive tags, occurrence horizons, custom schema constraints, extensions and Markdown body. It lifts the contract version and adds optional assignee support without rebuilding these policies from plugin defaults. Ordinary settings changes update only plugin-owned options. Task files are not changed. Collections that TaskNotes App has already updated retain their task definitions. If a beta added a second task type named `tasknotes-task` after TaskNotes App updated the collection, TaskNotes removes that duplicate and keeps a copy under `.tasknotes/migrations/`.

### Connecting TaskNotes App

Publishing a compatible task contract is not pack installation. The plugin does not write `mdbase.lock.yaml` or claim pack provenance. On the first App connection, use **Set up and allow access** for the App's engine-verified pack installation or upgrade, including its view/Base contracts. Use an App version that supports the current task contract; do not install an older task pack over it. Review the collection's task count and custom mapped values after setup. A CLI pack assessment of `install` or `upgrade` before that consent is expected, not a claim that the task metadata migration failed.

If the integration is not enabled, nothing changes.

Existing collection membership settings are retained: omitting `explicit_type_keys` means the engine's `type` and `types` defaults, and an explicit empty list remains empty. Only genuinely new plugin collections choose `mdbase_type`. TaskNotes encodes excluded folders as task-type path predicates, including nested folders but not similarly named siblings; it does not globally exclude records of other types.

TaskNotes additively includes `md` and `base` record extensions and Base includes for `TaskNotes/Views` and folders containing configured view files. Existing extensions, includes and other collection configuration are never removed. Invalid canonical mappings or binding policies are reported with the type's path and validation details; plugin settings remain at their last valid values. Review `implements.fields` (especially required `status` and `dateCreated`) and `binding`, then retry after correcting the configuration.

### TaskNotes App setup is separate

Metadata compatibility is not pack installation. TaskNotes does **not** create or stamp `mdbase.lock.yaml` or pack provenance. When connecting the App, approve its one-time **Set up and allow access** step: the engine assesses and installs or upgrades packs, including saved-view/Base contracts. An `install` or `upgrade` assessment before that consent is expected, even when the task contract is already current. Existing pack locks are retained until engine-approved setup.

### Check existing task records

Metadata migration never silently repairs old notes. A tag-identified task may lack the portable contract's required creation timestamp, or contain a status outside the configured vocabulary. Run **TaskNotes: Check collection** from the command palette after upgrading:

1. Review the invalid records and their schema/contract errors. Checking alone changes no notes.
2. For missing creation dates, **Back up and fix** offers the file's creation time. Check that time in the confirmation; copying files between devices can change filesystem creation times.
3. For invalid statuses, choose a replacement separately for each record. No status mapping is inferred. The all-record action applies only selected replacements and missing-date fixes; it leaves other errors untouched.
4. Confirm the exact listed changes. Each original note is verified in `.tasknotes/migrations/` before its change, and the repair refuses to overwrite a note changed since the check. Cancel keeps every note unchanged.
5. Recheck the results. Other invalid fields, malformed notes and custom schema constraints need manual review. Custom CEL match expressions not generated by TaskNotes require engine validation rather than guessed membership.

For independent verification, use `mdbase -C <collection> validate`, `types list`, `query --types <task-type-name>` and `packs assess` with the App's manifest/resources. Compare task counts and mapped values, not just metadata version numbers. `Check collection` checks task record schemas, portable contract projections and status vocabulary; engine validation also checks collection-wide rules and links.

If the integration is not enabled, migration does nothing. The collection-check command requires existing canonical mdbase metadata.

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
