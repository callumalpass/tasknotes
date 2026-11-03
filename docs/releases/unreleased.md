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

- Shortened the v5 and app announcement above the release notes, removed Android tester sign-up instructions, and refreshed the plugin beta link.
- (#2486) Collapsed Kanban columns now show the column's icon and title in the collapsed strip, with the title written vertically from top to bottom and long titles cut off. Previously the title was hidden, so collapsed columns could only be told apart by their colour. See [Collapsing Columns](https://tasknotes.dev/views/kanban-view/#collapsing-columns)
  - Thanks to @UniCode9696 for the suggestion

## Fixed

- (#2484) Fixed collapsed Kanban columns expanding again after Obsidian restarts or the view reloads. Collapsed columns are now saved in the view's `.base` configuration, like column order. See [Collapsing Columns](https://tasknotes.dev/views/kanban-view/#collapsing-columns)
  - Thanks to @UniCode9696 for reporting this
