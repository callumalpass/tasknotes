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

- (#789) Fixed folder path truncation in settings causing tasks to be created in wrong paths
  - Changed debounce to trailing mode to ensure final value is saved instead of partial input
  - Fixes issue where rapid typing, paste, or autocomplete would save incomplete folder paths
  - Thanks to @sascha224 for reporting

- (#806) Fixed Bases views crashing on Obsidian 1.10.0 startup
  - TaskNotes Bases views (Task List and Kanban) now restore correctly when already open at startup
  - Added defensive checks in `setEphemeralState` to handle early lifecycle calls
  - Added `focus()` method to view objects for proper restoration
  - Made root elements focusable to support Obsidian 1.10.0 view lifecycle

- (#792, #800) Fixed markdown-style project and dependency links not being recognized in frontmatter
  - Added support for markdown link format `[text](path)` in projects and blockedBy fields
  - Handles URL-encoded paths like `[Car Maintenance](../../projects/Car%20Maintenance.md)`
  - Markdown links now render as clickable links showing display text instead of raw `[text](path)` format
  - Links are properly resolved for grouping, filtering, and project-task associations
  - Previously only wikilink format `[[path]]` was supported
  - Prevents automatic removal of project assignments when editing tasks
  - Thanks to @minchinweb for reporting

- (#780) Fixed "Cannot Create Timeblocks" error when daily notes folder doesn't exist
  - Added proper error handling when `createDailyNote` fails due to missing folder
  - Improved error messages to guide users to check Daily Notes plugin configuration
  - Prevents uncaught errors from `obsidian-daily-notes-interface` package
  - Thanks to @uberunix for reporting

