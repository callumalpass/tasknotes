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

- Added Today and Inbox commands for the configured tasks Base, plus Inbox and Archived views in newly generated defaults. See [Views](https://tasknotes.dev/views/).

## Changed

- Newly generated tasks Bases open on Today. Active default task, Kanban, and calendar views exclude the configured archive tag. Existing Base files remain unchanged unless you explicitly update them.
- New installs show Create task, Tasks, and Calendar ribbon actions; other views remain available through commands and Obsidian's ribbon configuration. Existing ribbon preferences are retained.
- The starter note now introduces creating, reviewing, and completing a task in the selected interface language. Starter guidance and upgrade hints use the native v5 settings routes.
- Google Calendar sync commands appear only when task export is enabled; current-task sync also requires an active task note.

## Fixed

- Updating default Base files now repairs open Bases whose selected view was removed. Opening a configured Base also recovers a stale selected view.
- Korean now appears as 한국어 in the language selector.

## Removed

- Removed the Statistics and Pomodoro statistics dashboards and generated Pomodoro statistics template. The Pomodoro timer, time tracking, stored history, API, and existing Base files are retained. Close any old statistics tabs after upgrading. See [Time Management](https://tasknotes.dev/features/time-management/).
- Removed the unused views button alignment control. Its saved value is retained for downgrade compatibility.
