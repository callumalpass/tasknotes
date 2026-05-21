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

- (#1911) Fixed recurrence choices starting from today instead of the selected calendar date when creating a task from Calendar view.
  - Thanks to @mikhailmarka for reporting.
- (#1912) Fixed "Create subtask" inserting the full path of the parent task (e.g. `[[Tasks/Parent Task]]`) into the Projects field instead of just the basename (`[[Parent Task]]`). The link now matches the form used by "Add as Subtask" and other project-link generators.
