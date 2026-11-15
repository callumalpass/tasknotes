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

- Added calendar time slot height and pinch resizing controls, including the height setting in v5's native Calendar defaults page. See [Calendar Settings](https://tasknotes.dev/settings/calendar-settings/).
  - Thanks to @AIDockerCloud for contributing the height setting
- Added **Reset status after each occurrence** in Time & reminders. Existing setups keep their recurring series' status unless this setting is enabled. See [Recurring Tasks](https://tasknotes.dev/features/recurring-tasks/).
  - Thanks to @Pondering-Peregrine for reporting #2521

## Fixed

- (#2119) TaskNotes API tasks and events no longer expose internal Bases data, which could cause circular JSON errors in companion plugins.
  - Thanks to @chrabia for reporting this and @konstantinopolka for finding the cause
- (#2524) Generated Bases formulas use `isEmpty()` so missing time entries show **Not started**. Existing, manually edited Base files are not replaced automatically. See [Default Base Templates](https://tasknotes.dev/views/default-base-templates/).
  - Thanks to @dsebastien for reporting this and proposing the fix
- (#2527, #2528, #2529) Calendar timeblock text remains readable without its colour fill, timed events retain their time when there is room, and back-to-back events are not grouped as overlapping.
  - Thanks to @RumiaKitinari for reporting these issues
- (#2531) Editing a Kanban card preserves the board's horizontal and vertical scroll positions.
  - Thanks to @petrabuchinger2025-code for reporting this
- (#2540) Tasks with only a due date use that date in ICS exports.
  - Thanks to @jayhemnani9910 for contributing the fix
- (#2542) Connected calendar views refresh after event deletion. Google meeting deletion does not send cancellation emails, and recurring deletion affects only the selected occurrence.
  - Thanks to @iantierney for requesting calendar event deletion

## Security

- Updated Hono and its Node server adapter, used by the MCP SDK, to the security-fixed versions from the stable release.
