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

- (#1921) Fixed Google Calendar and auto-archive side effects falling stale after direct task file edits.
  - Reconciles lifecycle-relevant frontmatter changes through the existing task file update event, with a first-run fingerprint baseline to avoid bulk startup API writes.
- (#1911) Fixed recurrence choices starting from today instead of the selected calendar date when creating a task from Calendar view.
  - Thanks to @mikhailmarka for reporting.
