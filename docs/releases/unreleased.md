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
  - Added runtime sanitization in calendar with safe defaults (00:00:00, 24:00:00, 08:00:00)
  - Prevents "Cannot read properties of null (reading 'years')" error from FullCalendar
  - Thanks to @userhandle for reporting and help debugging
```

-->

## Fixed

- (#806) Fixed Bases views crashing on Obsidian 1.10.0 startup
  - TaskNotes Bases views (Task List and Kanban) now restore correctly when already open at startup
  - Added defensive checks in `setEphemeralState` to handle early lifecycle calls
  - Added `focus()` method to view objects for proper restoration
  - Made root elements focusable to support Obsidian 1.10.0 view lifecycle

- (#780) Fixed "Cannot Create Timeblocks" error when daily notes folder doesn't exist
  - Added proper error handling when `createDailyNote` fails due to missing folder
  - Improved error messages to guide users to check Daily Notes plugin configuration
  - Prevents uncaught errors from `obsidian-daily-notes-interface` package
  - Thanks to @uberunix for reporting

