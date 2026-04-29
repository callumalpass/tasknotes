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

- Persist failed Google Calendar task-event deletions in plugin data and retry them after restart or reconnect, preventing orphaned task events when a task file is deleted while Google cleanup fails or sync is not ready.
- Track exported Google Calendar task events in plugin data so startup can recover cleanup for task files deleted while Obsidian was closed.
- Persist Google Calendar task sync requests while Google Calendar is not ready and replay the current task state after reconnect for scheduled, due, or both-date calendar modes.
- Restore cancelled Google Calendar event tombstones when a task is synced to an existing event ID, so deleted-but-still-addressable events become visible again.
- Prevent duplicate Google Calendar task events when concurrent syncs race before the newly created event ID reaches Obsidian metadata.
- Prevent pending intermediate status updates from overwriting completed Google Calendar task events when users quickly cycle a task to done.
