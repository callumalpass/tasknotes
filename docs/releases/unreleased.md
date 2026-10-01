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

- (#2375) Added an option to show all-day Google Calendar task exports as Free without blocking availability, including tasks converted to all-day events. Timed exports remain Busy. Run Sync all tasks to update existing events. See [Calendar Integration](https://tasknotes.dev/features/calendar-integration/#google-calendar-task-availability).
  - Thanks to @szatzger for the suggestion.
- (#2326) Added a stop button to the tracking status bar and a **Stop active time tracking** command. One active tracker stops directly; multiple trackers prompt you to choose one. See [Time Management](https://tasknotes.dev/features/time-management/#stop-an-active-tracker-without-opening-its-note).
  - Thanks to @sumiyalairu03 for the suggestion and @kjohnsen for the command-palette follow-up.

## Fixed

- (#2328) Fixed rapid direct edits to an occurrence's status losing subsequent completion or reopening changes while recurrence reconciliation was still running.
  - Thanks to @mudnug for reporting the recurrence issue.
- (#2363) Added live validation for incomplete property-based task identification, replaced misleading example placeholders, and aligned generated Base filters with task lookup. Task indexes now refresh when the identification method, property name, or value changes. See [General Settings](https://tasknotes.dev/settings/general/#task-identification).
  - Thanks to @cagechi for reporting the status-action problem and providing settings and Base examples.
