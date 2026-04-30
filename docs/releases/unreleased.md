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

- (#1696) Fixed Google Calendar recurring tasks creating duplicate moved occurrences instead of converging on one series instance plus one detached exception event
  - Scheduled-anchor recurring moves now preserve the original series date, add the correct Google `EXDATE`, and create or remove the detached Google event as the moved occurrence is resolved
  - Archive, delete, and retry flows now clean up both the recurring master link and any detached exception link so stale Google events do not linger
  - Thanks to @martin-forge for reporting, reproducing, and patching the recurring exception sync failure
- (#1823) Fixed zero-duration timed external calendar events rendering on multiple days in list-style calendar views
  - Adds a minimal display duration before passing point-in-time external events to FullCalendar
  - Preserves the original provider event data for context menus and debugging
  - Thanks to @martin-forge for reporting and debugging
- Persist failed Google Calendar task-event deletions in plugin data and retry them after restart or reconnect, preventing orphaned task events when a task file is deleted while Google cleanup fails or sync is not ready.
- Track exported Google Calendar task events in plugin data so startup can recover cleanup for task files deleted while Obsidian was closed.
- Persist Google Calendar task sync requests while Google Calendar is not ready and replay the current task state after reconnect for scheduled, due, or both-date calendar modes.
- Restore cancelled Google Calendar event tombstones when a task is synced to an existing event ID, so deleted-but-still-addressable events become visible again.
- Prevent duplicate Google Calendar task events when concurrent syncs race before the newly created event ID reaches Obsidian metadata.
- Prevent pending intermediate status updates from overwriting completed Google Calendar task events when users quickly cycle a task to done.
- Mark Google Calendar events as completed when tasks were already done before they became calendar-eligible.
- Google Calendar task descriptions now use mobile-friendly plain text for Obsidian links and display labels for wiki-style project/context links.
