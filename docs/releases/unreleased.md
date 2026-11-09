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

- (#2527) Fixed timeblock titles being invisible in light themes in the calendar's "+N more" popover for overlapping events, in month view and in list view. These places draw the timeblock without its colour fill, but the text stayed white. It now uses the theme's text colour there. Property-based calendar events had the same problem and are fixed too.
  - Thanks to @RumiaKitinari for reporting this
- (#2531) Fixed Kanban boards jumping back to the left after a card was edited and saved while the board was scrolled sideways. Refreshing the board now keeps its horizontal and vertical scroll position along with each column's scroll position.
  - Thanks to @petrabuchinger2025-code for reporting this
