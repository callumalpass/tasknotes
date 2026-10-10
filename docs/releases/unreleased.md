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

## Added

## Changed

## Removed

## Fixed

- (#2382) Fixed Kanban settings being ignored in existing `.base` files when nested under `options:` or `config:`, including empty-column hiding and pinned columns. Newly generated default files and exported v3 views now write settings directly on each view; existing files remain unchanged. See [Kanban View](https://tasknotes.dev/views/kanban-view/#configuration). Thanks to @techwiththiru for reporting this.
- (#2390) Fixed the "Add to Project" modal listing notes from folders set in the Excluded folders setting. Thanks to @hikatamika for reporting this.
