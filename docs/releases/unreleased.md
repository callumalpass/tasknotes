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

- (#781, #1085) Fixed Outlook-published ICS calendar events appearing at the wrong time when their feed used Windows timezone names without matching timezone definitions.
  - Thanks to @chrlaney for reporting and @mjkrasny for confirming the Outlook timezone case.
- (#1696) Fixed Google Calendar export for scheduled recurring tasks when a single occurrence is moved to a different date.
  - Keeps the recurring master event on its original rule, excludes the original occurrence date, and syncs the moved occurrence as a detached event.
  - Thanks to @martin-forge for reporting and contributing the fix.
- (#1912) Fixed "Create subtask" inserting the full path of the parent task in the Projects field instead of using the normal Obsidian link text.
  - Thanks to @pkuehne for reporting and @benmartinek for confirming.
