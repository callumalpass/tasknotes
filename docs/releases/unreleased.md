# TaskNotes - Unreleased

<!--

**Added** for new features.
**Changed** for changes in existing functionality.
**Deprecated** for soon-to-be removed features.
**Removed** for now removed features.
**Fixed** for any bug fixes.
**Security** in case of vulnerabilities.

Always acknowledge contributors and those who report issues.

Example:

```
## Fixed

- (#768) Fixed calendar view appearing empty in week and day views due to invalid time configuration values
  - Added time validation in settings UI with proper error messages and debouncing
  - Prevents "Cannot read properties of null (reading 'years')" error from FullCalendar
  - Thanks to @userhandle for reporting and help debugging
```

When a change has user-facing documentation, include a canonical tasknotes.dev link:

```
## Added

- Added materialized occurrence notes for recurring tasks. See [Recurring Tasks](https://tasknotes.dev/features/recurring-tasks/#materialized-occurrence-notes) for setup and calendar behavior.
```

-->

## Changed

- With the mdbase integration enabled, collection-wide app behaviour (natural-language triggers, task and occurrence templates, archive moves, stopping timers on completion, resetting checkboxes on recurrence, the frontmatter link format, and per-status next status, cycle exclusion and auto-archive) is now stored in the TaskNotes settings record, `_settings/dev.tasknotes.md`, which TaskNotes App also uses. The task type moves to the `tasknotes.task` 0.3.0-rc.6 contract, which no longer holds these settings. Upgrading a collection creates the record from your saved settings or the earlier task type in the same backed-up step; an existing record keeps its values and gains only missing ones. See [TaskNotes settings record](https://tasknotes.dev/migration-v4-to-v5/#tasknotes-settings-record).

## Fixed

- With the mdbase integration enabled, the first change to a setting stored in the TaskNotes settings record after upgrading a 4.x collection (for example turning off "Move archived tasks to folder" or changing the archive folder) is saved to `_settings/dev.tasknotes.md`. Previously it was kept only until Obsidian restarted.
- With the mdbase integration enabled, TaskNotes shows a notice naming any other `_settings/` file that also claims to be its settings record, such as a sync conflict copy of `_settings/dev.tasknotes.md`. It keeps using `_settings/dev.tasknotes.md` and leaves the other files unchanged. See [TaskNotes settings record](https://tasknotes.dev/migration-v4-to-v5/#tasknotes-settings-record).
- With "Use Markdown links in frontmatter" on, TaskNotes now writes Markdown links even when Obsidian's own "Use [[Wikilinks]]" preference is on. This covers the project picker, dependencies, projects typed in natural-language input (task modal, inline conversion, API, MCP and CLI), the parent-note project default and the Bases current-file default.
- A failed or interrupted mdbase metadata update now removes the files it created (contracts, schemas, the settings type and settings record) and its temporary `.tasknotes-stage-` files, as long as they still hold exactly what TaskNotes wrote. Edited files are kept.
