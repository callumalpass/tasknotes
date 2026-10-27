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
