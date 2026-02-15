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

## Changed

- Published [`mdbase-tasknotes`](https://github.com/callumalpass/mdbase-tasknotes) (`mtn`), a standalone CLI for managing tasks directly on markdown files via mdbase
  - Works on the same vault and `_types/task.md` schema that TaskNotes generates— no plugin or HTTP API required
  - Preferable over [`tasknotes-cli`](https//github.com/callumalpass/tasknotes-cli) when Obsidian isn't running, on headless/remote machines, in shell scripts and CI pipelines, or anywhere the plugin's HTTP API isn't reachable
  - Natural language task creation via `tasknotes-nlp-core`, plus time tracking, project aggregation, statistics, and an interactive REPL
  - Install with `npm install -g mdbase-tasknotes`

- Extracted shared natural language parsing logic into the standalone npm package [`tasknotes-nlp-core`](https://github.com/callumalpass/tasknotes-nlp-core)
  - Core parser, trigger config service, language configs, and shared NLP types now live in the package
  - TaskNotes now uses a thin adapter in `src/services/NaturalLanguageParser.ts` to preserve plugin-facing API behavior
  - TaskNotes depends on `tasknotes-nlp-core` via npm instead of a local package import, which simplifies reuse in other tools (for example mdbase-backed CLI workflows)

## Added

- (#1549) Added setting to reset markdown checkboxes when recurring tasks are completed
  - When enabled, all checked checkboxes (`- [x]`) in the task body are reset to unchecked when a recurring task instance is completed and rescheduled
  - Useful for recurring tasks with subtask checklists that need to be repeated each instance
  - Configurable via Settings > Features > Recurring Tasks > "Reset checkboxes on recurrence"
  - Thanks to @phortx for the feature request

- (#1548) Added ability to create calendar events on connected external calendars directly from the calendar view
  - When clicking or dragging to select a time slot, a new "Create calendar event" option appears in the context menu
  - Opens a modal to enter event title, description, location, and select which calendar to create on
  - Supports both Google Calendar and Microsoft Calendar providers
  - Thanks to @Robubble for the feature request

- (#1597) Added MCP server for AI agent integration
  - Exposes TaskNotes tools at `/mcp` endpoint, gated behind `enableMCP` setting
  - Supports tasks (CRUD, query, toggle status/archive, parse from text), time tracking, pomodoro, calendar events, and task statistics
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

- (#1582) Fixed recurring tasks not appearing at end of visible calendar range for non-UTC timezones
  - Daily/weekly recurring tasks with times after ~1pm would disappear on the last day of the visible range for users in positive UTC offsets (e.g., UTC+11)
  - Fixed date boundary comparisons in both `generateRecurringInstances()` and `generateRecurringTaskInstances()` to compare dates only, not timestamps
  - Thanks to @benefitbug for reporting

- (#1580) Fixed Google Calendar sync failing after OAuth token expires with unhelpful error message
  - When refresh tokens expire or are revoked (e.g., Google Cloud project in Testing mode, user revoked access), the error message was confusing: "Failed to refresh google token: Request failed, status 400"
  - Now detects irrecoverable token errors (`invalid_grant`, `invalid_client`) and automatically disconnects the OAuth connection
  - Shows actionable error message: "Google Calendar connection expired. Please reconnect in Settings > Integrations."
  - Prevents repeated failed refresh attempts and error message spam
  - Thanks to @osxisl for reporting

- (#1584) Fixed DOMTokenList error when task status values contain spaces
  - Clicking the status ring on a task card threw an error when status contained spaces (e.g., "In Progress")
  - Status and priority values are now sanitized before being used as CSS class names
  - Thanks to @omber for reporting
