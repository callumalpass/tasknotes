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

## Fixed

- Stop plugin startup when an existing settings file cannot be read, preserving it for recovery instead of starting services with default settings.

- (#1849) Fixed context menus stacking on top of each other. Only one menu stays open at a time, and clicking the same indicator again closes its menu. This previously applied to date fields only, and now covers priority, status, recurrence, reminders, task, ICS event, and batch menus.
  - Thanks to @3zra47 for reporting and @YBKF for the contribution.

## Added

- (#2147) Added context-menu actions for recording task completion today, on the scheduled date, on the due date, or on a chosen date. The actions can be grouped in a submenu from Appearance settings. See [Completing Tasks](https://tasknotes.dev/features/task-management/#completing-tasks).
  - Rescheduling a recurring task can reactivate affected completed or skipped instances after confirmation. See [Recurring Tasks](https://tasknotes.dev/features/recurring-tasks/).
  - Thanks to @renatomen for the contribution.
