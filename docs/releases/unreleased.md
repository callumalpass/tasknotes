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

## Added

- (#1597) Added MCP (Model Context Protocol) server for AI agent integration
  - Exposes TaskNotes tools at `/mcp` endpoint, gated behind `enableMCP` setting
  - Supports tasks (CRUD, query, toggle status/archive, parse from text), time tracking, pomodoro, calendar events, and task statistics
  - Useful for remote/hosted AI clients like Claude or ChatGPT on mobile
  - Thanks to @dstotijn for the contribution

## Fixed

- (#1597) Fixed webhook payloads for time tracking start-with-description containing stale data
  - Thanks to @dstotijn for the fix
