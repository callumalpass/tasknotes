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

- (#1885) Added Shift+arrow keyboard range selection while bulk task selection mode is active.
  - Thanks to @chrabia for suggesting bulk selection improvements and @sumiyalairu03 for the keyboard selection idea.

## Fixed

- (#781, #1085) Fixed Outlook-published ICS calendar events appearing at the wrong time when their feed used Windows timezone names without matching timezone definitions.
  - Thanks to @chrlaney for reporting and @mjkrasny for confirming the Outlook timezone case.
- (#1696) Fixed Google Calendar export for scheduled recurring tasks when a single occurrence is moved to a different date.
  - Keeps the recurring master event on its original rule, excludes the original occurrence date, and syncs the moved occurrence as a detached event.
  - Thanks to @martin-forge for reporting and contributing the fix.
- (#1912) Fixed "Create subtask" inserting the full path of the parent task in the Projects field instead of using the normal Obsidian link text.
  - Thanks to @pkuehne for reporting and @benmartinek for confirming.
- (#1921) Fixed Google Calendar and auto-archive side effects falling stale after direct task file edits.
  - Reconciles lifecycle-relevant frontmatter changes through the existing task file update event, with a first-run fingerprint baseline to avoid bulk startup API writes.
  - Batched recovery also cleans up indexed Google Calendar events whose task files were deleted or replaced outside the normal TaskNotes delete path, without scanning the full vault every minute.
  - Added internal profiling around this recovery path so performance can be checked in large vaults.
  - Thanks to @martin-forge for reporting and contributing the fix.
- (#1938) Fixed partial HTTP API task updates rewriting native tags with `#` prefixes or duplicate task tags.
  - Thanks to @joseluisgonzalezdelgado-ctrl for reporting.
- (#1939) Fixed the task Details field rendering as a small nested textarea when the embedded editor falls back.
  - Thanks to @g-arthurvanderbilt for reporting and @cookbr for confirming the desktop impact.
- Fixed tag and modal preview edge cases found during validation: double-hash tags no longer match the task tag, empty tag lists stay empty when read back, and natural-language previews remain visible when enabled.
- (#1941) Fixed mobile Kanban boards scrolling the whole board vertically instead of keeping each list independently scrollable.
  - Thanks to @pxxush for reporting.
- (#1943) Fixed MCP task-query tool instructions so filter operators match the operators TaskNotes actually accepts.
  - Thanks to @jordankbartos for reporting and proposing a fix in #1944.
- (#1945) Fixed Google Calendar export so overlapping sync services do not create duplicate events for the same task while the saved event ID is still catching up.
  - Thanks to @martin-forge for reporting and contributing the fix.
- (#1946) Fixed the bottom task in virtualized Task List Bases being partially hidden behind Obsidian's mobile bottom bar.
  - Thanks to @3zra47 for reporting.
- (#1947) Fixed mobile Task List cards with left-positioned subtask chevrons so the chevron remains visible and project/detail badges stay on the main row.
  - Thanks to @Jomo94 for reporting.
- (#1948) Fixed Agenda Calendar Bases so completed recurring instances can appear on their recorded completion dates, even when recurring task projections are hidden or the completion date is outside the recurrence pattern.
  - Thanks to @Jomo94 for reporting.
