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

- (#1696) Fixed Google Calendar recurring tasks creating duplicate moved occurrences instead of converging on one series instance plus one detached exception event
  - Scheduled-anchor recurring moves now preserve the original series date, add the correct Google `EXDATE`, and create or remove the detached Google event as the moved occurrence is resolved
  - Archive, delete, and retry flows now clean up both the recurring master link and any detached exception link so stale Google events do not linger
  - Thanks to @martin-forge for reporting, reproducing, and patching the recurring exception sync failure
