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
| Daily notes | Your daily-note folder | Pomodoro history when daily-note storage is enabled (the default for new installs) |
| mdbase configuration | `mdbase.yaml`, `_mdbase/` (including `_mdbase/settings/dev.tasknotes.md`), legacy `_settings/` records, older configured type/contract and schema folders, pack lock/provisions, and `.tasknotes/migrations/` when configured | Shared collection metadata, provenance, and migration recovery copies |

Treat `data.json` as sensitive because integration configuration, such as webhook URLs and calendar subscription URLs, can include private values. OAuth credentials, calendar account tokens, and the HTTP API token are kept in Obsidian Secret Storage on each device instead, so they are not part of a vault backup and must be set up again when restoring onto a new device. Store backups accordingly.

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

## Interrupted mdbase metadata updates

TaskNotes journals v0.2 and beta metadata upgrades and automatically recovers interrupted writes on restart. Replacements on desktop and mobile move the actual revision into `.tasknotes/migrations/metadata-swaps/` before publishing the staged file to an empty path. Swap journals retain the expected original, intended bytes, stage and recovery paths. If a restart finds an empty active path with its moved original present, it restores that revision through the same verified publication path; the enclosing upgrade can then recover. Native filesystem publication refuses an occupied destination; non-native adapter limitations are described below. If a file has changed externally, recovery stops and the notice lists the pending journal, backup folder, and blocked file. Keep those copies. Close all syncing Obsidian instances, back up the current vault, and compare the active files with the backup manifest before restoring the config, task type, and support resources together. Preserve external edits separately; do not delete the pending journal to bypass the conflict. Resolve permissions or the conflicting revision, then reload TaskNotes. Task notes are not rewritten by migration.

On storage without native Node filesystem access, migration remains enabled using the adapter's empty-destination move. TaskNotes moves a verified publication copy and compares the active bytes with the retained intended stage. The displaced original, stage and journal remain until read-back passes; divergence raises a conflict notice and retains those files for review.

An iOS/Android adapter that implements its destination check separately from its rename still has a residual check-then-rename window. A concurrent arrival during that window can be overwritten, and matching final read-back cannot reveal that lost arrival. Read-back therefore does not make this path atomic. Finish syncing before migration, avoid metadata updates from other devices while it runs, and keep a separate full-vault backup and file history. If a revision is missing, preserve the current vault and recover it from your independent backup or sync history rather than assuming the migration journal captured it.

The pending journal is one of `.tasknotes/migrations/metadata-swaps/<id>.json`, `mdbase-v0.2-pending.json` or `mdbase-v0.3-pending.json`. A failed update restores unchanged original metadata and removes the files it created, such as new contracts, schemas, the settings type and the settings record, along with its temporary `.tasknotes-stage-` files. A created file is removed only while it still holds exactly what TaskNotes wrote; a file edited since is kept. Do not delete a pending journal or restore only the contract file to force an upgrade.

A settings-save synchronization failure shows recovery details immediately, and distinguishes saved plugin settings from a completed metadata update. Repeated failures for the same pending journal do not repeat the notice during the session.

## mdbase metadata upgrades

This section is reference detail for the automatic mdbase metadata upgrade described in [Upgrading from v4 to v5](../migration-v4-to-v5.md#mdbase-collections).

### Which metadata is upgraded

When the collection's only active type is an unmodified TaskNotes-generated v0.2 type, TaskNotes upgrades the metadata to mdbase v0.3 automatically. Generated formats from 4.3.2 through 4.18.x are recognized using their historical writers and your saved settings, including a legacy single user field and user field names with surrounding spaces. BOM/CRLF formatting and reordered YAML mapping keys are accepted. Exact historical output containing v4's invalid unquoted status values can also be regenerated safely from those settings. The original bytes of `mdbase.yaml`, the task type and replaced support resources are kept under `.tasknotes/migrations/`.

If v4 added its generated task type to an existing v0.3 collection, TaskNotes upgrades that file in place and preserves other types and configuration instead of creating an overlapping task type.

Incomplete synced metadata is not treated as a new collection. If type or support files arrive before `mdbase.yaml`, TaskNotes waits without creating another type, and retries when the configuration or task type arrives.

For a collection written by a 5.0 beta or TaskNotes App, TaskNotes updates the task type to the current contract when the vault opens and tells you once. The previous type is backed up under `.tasknotes/migrations/`. The upgrade keeps existing property-role mappings (including custom stable IDs), binding policies, archive tags, occurrence horizons, custom schema constraints, extensions and Markdown body. App behaviour settings move from the type to the settings record unchanged. Text, number, date, boolean and list custom properties keep their declarations. An owned property whose type cannot be resolved stops settings import with a named diagnostic instead of disappearing. Collections that TaskNotes App has already updated keep their task definitions. If a beta added a second task type named `tasknotes-task` after TaskNotes App updated the collection, TaskNotes moves that duplicate into a unique folder under `.tasknotes/migrations/`.

The settings record is created in the same backed-up step as the task type upgrade: from your saved settings for a v4 collection, or from the earlier task type for a 5.0 beta or TaskNotes App collection. If the record already exists, TaskNotes keeps every setting it holds and adds only the ones the upgrade moved. Outside upgrades, opening a vault never creates or changes the record. A setting missing from the record, or invalid in it, is read from an earlier task type that still holds it, otherwise it takes its default. A record written by a newer settings version is used as written and not changed.

### Blocked upgrades

Additional v0.2 types, or task and support definitions that have been edited, are kept for review, and the notice names the affected file. Back up the vault, finish syncing and restart first. If the upgrade is still blocked, restore the unmodified generated type **and matching saved settings** from a known-good backup, or use mdbase to migrate a separate copy and review all type definitions before replacing the active metadata. Do not delete a user-maintained type just to make the upgrade go ahead. Known generated support resources tolerate line-ending changes; custom commentary or schema edits are not overwritten.

When more than one TaskNotes task type remains, startup lists every candidate path and keeps the last-known-good plugin configuration. Review which type the plugin should manage. Keep types that records refer to explicitly until you have reviewed their membership. TaskNotes App supports several task types, but the plugin's configuration currently needs one.

Storage adapters without safe metadata replacement or move support stop with a notice rather than deleting existing files. Symlinked metadata directories are refused before changes are made; use physical directories inside the vault and update `mdbase.yaml` to match.

### Collection membership and configuration

Existing collection membership settings are kept: omitting `explicit_type_keys` means the engine's `type` and `types` defaults, and an explicit empty list stays empty. Only new collections created by TaskNotes use `mdbase_type`. TaskNotes encodes excluded folders as automatic task-type path predicates, including nested folders but not similarly named siblings; it does not exclude records of other types. Explicit membership in `type`, `types` or configured keys takes precedence over automatic matching, so explicitly typed tasks in those folders stay collection members even when hidden from plugin views. Collection-wide `settings.exclude` and `include_subfolders: false` still exclude those paths from the collection.

TaskNotes adds `md` and `base` record extensions and Base includes for `TaskNotes/Views` and folders containing configured view files. Existing extensions, includes and other configuration are never removed. When `record_extensions` is absent, its initial values keep the engine's effective legacy `settings.extensions` (with Markdown always included) before adding `base`. Invalid extension settings stop the update instead of narrowing record coverage. Invalid mappings or binding policies are reported with the type's path and validation details, and plugin settings stay at their last valid values. Review `implements.fields` (especially the required `status` and `dateCreated`) and `binding`, then retry.

### How Check collection decides which notes to check

**TaskNotes: Check collection** uses the collection's effective scope, including collection-wide exclusions, subfolder settings, nested collection boundaries and explicit membership. It includes explicitly typed tasks hidden by plugin folder exclusions, but never offers repairs outside the collection. Nested `fields_present` and `match.where` references can use dotted paths, `[]` selectors or JSON Pointers. String or array `path_glob` predicates are respected. Unparseable membership or unsupported predicate forms stop the check rather than reporting a partial check as clean. Custom CEL match expressions not generated by TaskNotes need engine validation.

When a repair is applied, the current task type, status list and proposed output are checked again, so a stale preview must be checked again.

For independent verification, use `mdbase -C <collection> validate`, `types list`, `query --types <task-type-name>` and `packs assess` with TaskNotes App's manifest and resources. Compare task counts and mapped values, not just metadata version numbers. Check collection covers task record schemas, contract projections and the status list; engine validation also checks collection-wide rules and links.

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
- Broken default views: regenerate them from **Appearance & interaction → Views & base files**.
- Broken custom views: restore the individual `.base` files from history.
- Lost Pomodoro history: restore the configured storage source, which may be plugin data or daily-note frontmatter.
