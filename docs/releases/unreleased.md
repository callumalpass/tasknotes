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

-->

## Changed

- Updated the `urgencyScore` formula in default base templates to factor in time-of-day, so timed values that are earlier within a day rank above later ones at the same priority and date
  - Adds a 0..1 boost computed from the fractional day of `nextDate`, keeping priority weight and the days-until-next term as the dominant signals
  - Resolves a tie-break that previously depended on file-iteration order for same-priority same-date timed tasks
  - Date-only values fall back to midnight, so they sit at the top of their day bucket
