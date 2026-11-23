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

- Fixed **Show all properties on task cards** squeezing properties beside a card's dates instead of wrapping them. A property that did not fit beside the dates, such as a long project, stayed on their line and wrapped a word or a letter at a time; it now moves to a line of its own. Task List, Kanban and Agenda cards and the task card widget at the top of a task note also get back the setting's wider spacing, instead of 4px between items. On phones, task links in notes wrap the same way when **Show all properties on inline task cards** is on. Task Lists wide enough to show each task on one line are unchanged.
