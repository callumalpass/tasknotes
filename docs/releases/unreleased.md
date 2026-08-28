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

- (#2304) Fixed embedded month calendars not filling their available width with Minimal theme and Readable Line Length enabled. Thanks to @same774 for reporting.

- (#2305) Fixed tasks due after 11:30 PM appearing on the following day in Calendar and Agenda views.
  - Thanks to @PeterYuLi1204 for reporting.

- (#2306) Fixed the task editor's completion calendar showing dates from a different month than its heading in some time zones, and skipping short months when navigating from a month-end completion.
  - Thanks to @teampbevolution for reporting.

- (#2258) Task cards now preserve spaces and emoji in context and tag labels instead of collapsing them during display. Thanks to @Oblique82 for reporting this and tracing the affected renderer.
