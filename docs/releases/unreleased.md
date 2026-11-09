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

