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

- (#814) Fixed markdown links in projects field not being recognized on Project notes
  - Tasks with markdown-style project links `[text](path)` now appear in project's Subtasks section
  - Updated project link detection to use `parseLinkToPath` utility which handles both wikilinks and markdown links
  - Handles URL-encoded paths like `[z Test Project](z%20Test%20Project.md)`
  - Thanks to @minchinweb for reporting

