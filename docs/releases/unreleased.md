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

- Fixed generated [mdbase](https://mdbase.dev) type definitions for task dependencies using the wrong field type
  - In `_types/task.md`, `blockedBy[].uid` now uses `type: link` (was `type: string`)
  - Better matches how dependency links are serialized in task frontmatter (`[[...]]`)

- Fixed generated mdbase reminder type definitions to better match TaskNotes reminder data
  - In `_types/task.md`, `reminders[].type` now uses enum values `absolute|relative`
  - `reminders[].relatedTo` now uses enum values `due|scheduled`
  - `reminders[].absoluteTime` now uses `type: datetime` (was `type: string`)

- (#1597) Fixed webhook payloads for time tracking start-with-description containing stale data
  - Thanks to @dstotijn for the fix

- (#1581) Fixed Pomodoro starting break instead of work session after app restart
  - After completing a work session and restarting, pressing Start would incorrectly start a break
  - Now properly resets `nextSessionType` when clearing stale sessions or stopping the timer
  - Thanks to @Sirnii for the detailed bug report and root cause analysis

- (#1577) Fixed Edit Note/Task modal hiding action buttons when content exceeds viewport height
  - Added vertical scroll to modal content area while keeping buttons pinned at bottom
  - Thanks to @hossam-elshabory for reporting

- (#1600) Fixed kanban view grouping not working when more than 20 views exist
  - The `getGroupByPropertyId()` method had a hardcoded loop limit of 20 iterations
  - Views at index 20 or higher would not be found, causing groupBy to return null
  - Thanks to @IHaveNoShame for reporting

- (#1595) Fixed task modal floating buttons blocking content on mobile
  - Added mobile-specific (`body.is-mobile`) CSS to ensure proper flex layout
  - Button container now stays pinned at bottom without overlapping scrollable content
  - Thanks to @Jomo94 for reporting

- (#1590) Fixed HTTP API not allowing `blockedBy` dependencies when creating tasks
  - Added `blockedBy` field support to `TaskService.createTask()`
  - Updated API documentation with `blockedBy`, `recurrence`, and `reminders` fields
  - Thanks to @hGriff0n for reporting
