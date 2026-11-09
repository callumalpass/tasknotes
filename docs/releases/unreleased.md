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

- Added a time slot height setting for the calendar time grid, in Settings → Appearance → Time settings and in each calendar view's time grid options. Short slots such as 15 minutes no longer force a taller day: lower the height and the whole time range fits without scrolling.
  - Thanks to @AIDockerCloud for contributing this setting
- Added pinch to resize on calendar time grids. Two fingers on the grid change the slot height around the time beneath them, and the height is kept on that device. Turn it off with **Pinch to resize time slots** in the view's time grid options. See [Calendar Views](https://tasknotes.dev/views/calendar-views/)


## Fixed

- (#2524) Fixed the `trackingStatus` formula in generated default Bases views so tasks without time entries show "Not started". The formula tested emptiness with `!time_entries || list(time_entries).length == 0`, which Obsidian Bases evaluates to null rather than true when the property is missing or blank. Generated formulas now use `isEmpty()` for these checks. See [Default Base Templates](https://tasknotes.dev/views/default-base-templates/).
  - Existing `.base` files are not changed automatically. To pick up the fix, either use **Settings → TaskNotes → Views & base files → Update files** (this replaces manual edits in the default files), or edit the `trackingStatus` formula in each affected file (`tasks-default.base`, `kanban-default.base`, `agenda-default.base`, `calendar-default.base`, `mini-calendar-default.base`, `relationships.base`) and replace `!time_entries || list(time_entries).length == 0` with `time_entries.isEmpty()`. If you have mapped time entries to a different property name, use that name instead.
  - Thanks to @dsebastien for reporting this, tracing the cause and proposing the fix
