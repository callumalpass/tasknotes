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

## Fixed

- (#1124) Fixed `tasks-default.base` views and formulas excluding tasks scheduled or due today at a non-midnight time from day-level comparisons
  - `today()` returns midnight, so `date(due) == today()` and `date(due) <= today() + "7d"` evaluated to false for any value with a non-zero time
  - Affected views: Today, This Week
  - Affected formulas: `isDueThisWeek`, `isThisWeek`, `dueDateCategory`, `nextDateCategory`, `dueDateDisplay`
  - Added `.date()` to strip the time component before comparing, matching the pattern already used in `isDueToday` and `isScheduledToday`
  - Thanks to @kmaustral for reporting
