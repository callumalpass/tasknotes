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

- (#2537) Press Backspace immediately after highlighted natural language input to keep that word or phrase in the task title. See [Highlighting in Natural Language Input](https://tasknotes.dev/features/task-management/#highlighting-in-natural-language-input). Thanks to @ac8318740 for the proposal.

## Fixed

- (#2685) Reduced the pause when starting to drag a Kanban card, especially on large boards. Thanks to @Oneiran for reporting it.
- (#2688) Restored blue highlighting for past scheduled dates on task cards. Thanks to @saket-pareek for reporting.
- (#2679) Fixed short calendar timeblocks ending at midnight spilling into the next day. Thanks to @RumiaKitinari for reporting.
- Fixed moving a recurring task in the Calendar view clearing its completed and skipped occurrences without asking. Dragging the next occurrence to another day, or dropping the task onto the calendar from elsewhere, such as a task link in a note, removed every completed or skipped occurrence on or after the new date. The calendar now asks first and lists those dates, as changing the scheduled date from the date picker does; **Cancel** leaves the task where it was, with its history. See [Recurring Tasks](https://tasknotes.dev/features/recurring-tasks/#rescheduling-clears-later-instances).
  - Thanks to @martin-forge for the fix
