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

- (#2369) Aligned time-grid events and the current-time indicator with their time slots when a Calendar Base is embedded in a zoomed Canvas. Thanks to @rotzd for reporting this.
- (#2370) Fixed duplicate entries in the task modal's Blocked by list when dependency cards load concurrently. Thanks to @sandrahalling for reporting this.
- (#2367) Adding tasks to a timeblock no longer replaces an existing title. An empty title still defaults to the first selected task. Thanks to @m4to-3pe for reporting this.
