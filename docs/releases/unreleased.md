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

- (#1370) Clicking a recurring task's status indicator now follows the status cycle, as it does for other tasks, once the first completed status has a **Next status**. It moves the series through its open statuses, and reaching a completed status completes the occurrence shown on the card. Setups without that Next status keep completing the occurrence in one click, and dropping a recurring task on Done still completes it directly. TaskNotes' built-in Done status now moves on to Open, so a new setup gets this cycle and a finished series starts its next occurrence at Open. See [Recurring Tasks](https://tasknotes.dev/features/recurring-tasks/#completion-tracking).
  - Thanks to @Jomo94 for requesting this
- Shortened the v5 and app announcement above the release notes, removed Android tester sign-up instructions, and refreshed the plugin beta link.
- (#2486) Collapsed Kanban columns now show the column's icon and title in the collapsed strip, with the title written vertically from top to bottom and long titles cut off. Previously the title was hidden, so collapsed columns could only be told apart by their colour. See [Collapsing Columns](https://tasknotes.dev/views/kanban-view/#collapsing-columns)
  - Thanks to @UniCode9696 for the suggestion

## Fixed

- (#2484) Fixed collapsed Kanban columns expanding again after Obsidian restarts or the view reloads. Collapsed columns are now saved in the view's `.base` configuration, like column order. See [Collapsing Columns](https://tasknotes.dev/views/kanban-view/#collapsing-columns)
  - Thanks to @UniCode9696 for reporting this
