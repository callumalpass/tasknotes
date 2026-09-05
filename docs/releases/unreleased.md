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

When a change has user-facing documentation, include a canonical tasknotes.dev link:

```
## Added

- Added materialized occurrence notes for recurring tasks. See [Recurring Tasks](https://tasknotes.dev/features/recurring-tasks/#materialized-occurrence-notes) for setup and calendar behavior.
```

-->

## Fixed

- Rebase task edits on current frontmatter so an older edit window preserves externally completed recurrence occurrences and unrelated field changes.
- Stop plugin loading when an existing settings file cannot be read safely, and keep saved Pomodoro sessions paused at mobile startup.

## Added

- An optional **Rebuild private task projections** Google export setting gives projected tasks a durable `tasknotesUid`. At startup and every 15 minutes it repairs provider drift, duplicates, missing events and renamed source links from task files, even after the local event index is lost. It removes only marked, attendee-free projections and refuses ambiguous task identities. Unchanged projections do not write to Calendar.

## Security

- Generate a 256-bit token before starting API/MCP listeners and reject empty-token authentication.
- Bind OAuth callbacks to an OS-assigned loopback port, consume valid state before responding, reject replay, and return static pages with restrictive security headers.
- Re-read managed task events before deletion and use their ETags for conditional writes, preserving a competing provider edit for a subsequent reconciliation.
