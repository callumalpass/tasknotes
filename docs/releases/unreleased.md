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

- Added a **Repeat current task** command for reusing a completed task on a new
  date. It records the completion date in `complete_instances`, reopens the
  task, unarchives it if needed, and opens the edit modal so you can set the
  next scheduled and due dates. Useful for tasks that come back irregularly and
  do not fit a recurrence rule. See
  [Task Management](https://tasknotes.dev/features/task-management/#repeating-a-completed-task).
