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

- [Mdbase](https://mdbase.dev) type generation now emits `tn_role` annotations on schema fields, allowing external tools (e.g. [mtn CLI](https://github.com/callumalpass/mdbase-tasknotes)) to discover each field's semantic role regardless of custom frontmatter names
- Mdbase type match rules now use tag or frontmatter property matching (based on task identification settings) instead of path glob, with automatic fallback to tag matching
- Mdbase type status field now includes `tn_completed_values` annotation, listing which status values count as completed
- (#1576) Added an optional `Checklist Progress` task-card property that renders a compact progress bar and `completed/total` count from top-level markdown checkboxes
  - Uses Obsidian `metadataCache.listItems` parsing (no vault body reads), minimizing rendering overhead
  - Nested checklist items are excluded so progress reflects first-level task steps only
  - Bases views map `tasks` (`file.tasks`) to `Checklist Progress` for TaskNotes cards
  - Existing `.base` files need `file.tasks` added to the view `order` YAML manually (it is not auto-added to pickers by default)
  - Default generated `.base` templates now include `file.tasks` in view `order` arrays so checklist progress is available out of the box and then appears in the picker
  - Thanks to @phortx for the initial PR and for opening #1576

## Changed

- Mdbase type generation no longer overwrites `mdbase.yaml` if the file already exists, preserving user customisations
- Webhook emissions moved from API controllers and MCP layer into the service/domain layer, ensuring webhooks fire consistently regardless of entry point
- Webhook runtime state now syncs automatically when plugin settings change
- Extracted shared HTTP response/body-parsing utilities into a dedicated `httpUtils` module

## Fixed

- (#1602) Fixed time tracking statistics showing incorrect or zero values for Today/Week/Month due to UTC-anchored date range boundaries in Stats View
  - Updated range calculations to use local calendar-day boundaries consistently
- (#1602) Fixed inconsistent `timeEntries` timestamp formats across create/edit/drag/resize flows
  - Time entry timestamps are now written in canonical UTC ISO format (`toISOString()` with `Z`) across all write paths
- (#1602) Fixed denormalized `timeEntries.duration` drift after edits
  - Time tracking calculations now derive duration from `startTime`/`endTime`
  - Time entry save paths now strip legacy `duration` values instead of persisting them
  - Thanks to @dy66 for reporting issue #1602
