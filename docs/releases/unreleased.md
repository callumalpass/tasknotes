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

- Fixed [mdbase-spec](https://mdbase.dev) type definition generation not triggering when settings change
  - Improved generated `_types/task.md` to use proper multi-line YAML format with field descriptions

- (#1555) Fixed "Folder already exists" error when creating tasks or converting inline tasks
  - Used adapter filesystem check instead of in-memory cache for folder existence
  - Thanks to @jkune5 for reporting

- (#1532) Fixed expanded task modal buttons being cut off when content exceeds viewport height
  - Thanks to @willfanguy for reporting

- (#1556) Fixed completion-based recurring tasks not rescheduling when INTERVAL exceeds 30 (DAILY) or ~12 (WEEKLY)
  - The look-ahead window for finding the next occurrence now scales with the INTERVAL value
  - Thanks to @kazerniel for reporting
