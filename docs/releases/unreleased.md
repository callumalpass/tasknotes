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

- (#792, #800) Fixed markdown-style project and dependency links not being recognized in frontmatter
  - Added support for markdown link format `[text](path)` in projects and blockedBy fields
  - Handles URL-encoded paths like `[Car Maintenance](../../projects/Car%20Maintenance.md)`
  - Markdown links now render as clickable links showing display text instead of raw `[text](path)` format
  - Links are properly resolved for grouping, filtering, and project-task associations
  - Previously only wikilink format `[[path]]` was supported
  - Prevents automatic removal of project assignments when editing tasks
  - Thanks to @minchinweb for reporting

