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

- (#2119) Fixed companion plugins such as TaskNotes Workflows failing with "Converting circular structure to JSON" or "Maximum call stack size exceeded" after a task was moved on a Kanban board or edited in another Bases view. Tasks and task events from the TaskNotes API no longer include the internal Bases view data that views attach to a task.
  - Thanks to @chrabia for reporting this, and to @konstantinopolka for finding the cause

- (#2527) Fixed timeblock titles being invisible in light themes in the calendar's "+N more" popover for overlapping events, in month view and in list view. These places draw the timeblock without its colour fill, but the text stayed white. It now uses the theme's text colour there. Property-based calendar events had the same problem and are fixed too.
  - Thanks to @RumiaKitinari for reporting this
- (#2528) Fixed calendar time grids hiding the time range on some timed events and timeblocks. Events about an hour long or shorter lost their time in narrow columns, such as a week view, while longer ones kept it. Long titles could also push the time out of view. The time now stays visible whenever the event has room for two lines, and the title is shortened instead.
  - Thanks to @RumiaKitinari for reporting this
- (#2529) Fixed back-to-back events and timeblocks being grouped as overlapping in calendar time grids. When an event was drawn shorter than the minimum event height, for example with 15-minute events or a compact time slot height, an event starting exactly at its end was laid out beside it or collapsed into a group. Events that only touch now stay in one column.
  - Thanks to @RumiaKitinari for reporting this
- (#2531) Fixed Kanban boards jumping back to the left after a card was edited and saved while the board was scrolled sideways. Refreshing the board now keeps its horizontal and vertical scroll position along with each column's scroll position.
  - Thanks to @petrabuchinger2025-code for reporting this
