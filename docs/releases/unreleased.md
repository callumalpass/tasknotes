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

- (#1696) Fixed Google Calendar export for scheduled recurring tasks when a single occurrence is moved to a different date.
  - Keeps the recurring master event on its original rule, excludes the original occurrence date, and syncs the moved occurrence as a detached event.

- (#1911) Fixed recurrence choices starting from today instead of the selected calendar date when creating a task from Calendar view.
  - Thanks to @mikhailmarka for reporting.
