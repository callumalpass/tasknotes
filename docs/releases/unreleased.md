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

- (#2712) Made the Task Edit modal and the task card inside a note follow the sort configured in the Relationships Base’s Subtasks view. Thanks to @Glint-Eye for reporting.
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

- (#2705) Reduced startup work for vaults with mdbase type definitions enabled by reusing validation when a type file is unchanged between checks. Thanks to @minchinweb for reporting.

## Fixed

- Protect task notes from being emptied by a failed save, including during workflow loops. If TaskNotes cannot restore an empty note, it keeps a recovery copy and includes its location in the error. Thanks to @chrabia for reporting ([Workflows issue 27](https://github.com/callumalpass/tasknotes-workflows/issues/27)).
- (#2703) Apply Paste image rename’s automatic naming when saving a new task with a pasted screenshot, and keep the saved embed linked to that file. Thanks to @ubidev for reporting.
- (#2683) Scrolling up in Agenda and Calendar List now loads earlier days without shifting the visible tasks. Thanks to @Oneiran for reporting.
- (#2698) Dragging an all-day task into the calendar’s timed grid now previews the task’s time estimate. Thanks to @Oneiran for reporting.
- (#2720) Scoped the Ctrl/Cmd+Z undo shortcut to TaskNotes views and the undo toast so it no longer intercepts undo in other Obsidian views. Thanks to @LucDesautels for reporting.
