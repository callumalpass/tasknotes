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

- (#1546) Added sticky kanban column headers that remain visible while scrolling
  - Thanks to @normenmueller for the contribution

- (#1458) Added CSS color classes to context tags for custom styling
  - Context tags now receive a BEM modifier class (`context-tag--color-0` through `context-tag--color-19`) based on a consistent hash of the context name
  - Enables users to style individual contexts via CSS snippets
  - Thanks to @phortx for the contribution

## Fixed

- (#1472) Fixed task dependencies not being stored as wikilinks in frontmatter
  - `serializeDependencies()` now wraps UIDs in `[[...]]` brackets before writing to YAML
  - Previously, normalization stripped wikilink brackets but serialization never re-added them, causing dependencies to break on file rename
  - Thanks to @renekalff for reporting

- (#1443) Fixed default status/priority not updating when the referenced custom value is deleted
  - Deleting a custom status or priority that was set as the default now resets the default to the first available value
  - Added validation on settings render to catch stale defaults that reference non-existent values
  - Thanks to @l-mb for the contribution

- (#1448) Fixed project removals not persisting from the task edit modal
  - Removing all projects from a task now correctly deletes the `projects` field from frontmatter
  - Normalized link comparison so different link syntaxes (e.g., angle-bracket markdown links vs wikilinks) no longer cause false change detection
  - Thanks to @normenmueller for the contribution

- (#1514), (#1517) Fixed task reminders not syncing to Google Calendar
  - Task-specific reminders (both relative and absolute) are now converted to Google Calendar API format
  - Previously only the global `defaultReminderMinutes` setting was used, ignoring per-task reminders
  - Thanks to @christenbc for the contribution

- (#1525), (#1531) Fixed subtask status dot not refreshing visuals immediately on click
  - Status dot, checkbox, card classes, and CSS vars now update instantly when cycling status
  - Reuses shared status handler for newly-created status dots, eliminating duplicated logic
  - Card class updates now use `classList.toggle` instead of rebuilding `className`, preserving classes from other systems
  - Thanks to @christenbc for the contribution

- (#1533), (#1537) Fixed Google Calendar 403 rate limit errors during bulk sync
  - Added rate limiting to space out API calls, preventing errors when syncing many tasks (~350+)
  - Thanks to @Lorite for the contribution

- (#1515), (#1540) Fixed time loss when setting recurrence and recurrence not clearing from Google Calendar
  - Setting recurrence on a task with a scheduled time now preserves the time component in DTSTART, preventing Google Calendar events from appearing as all-day
  - Clearing recurrence from a task now explicitly removes it from the synced Google Calendar event
  - Thanks to @christenbc for the contribution

- (#1428), (#1559) Fixed hierarchical tags with slashes (e.g., `#project/sub-project`) being truncated in link text rendering
  - Tag regex now supports slashes, hyphens, and Unicode characters
  - Thanks to @normenmueller for the contribution

- (#1565) Fixed Google Calendar target calendar dropdown appearing empty after app restart
  - The dropdown now listens for the `data-changed` event so it re-populates once calendars are fetched during deferred startup initialization
  - Thanks to @N-HEDGER for reporting

- (#1567) Fixed inline task card widgets disappearing during transient cache invalidations
  - Added a path-keyed fallback widget cache so that when the task info cache is temporarily empty (e.g. during Smart Connections processing), the previously-rendered widget is reused instead of showing a plain wiki link
  - Stale fallback entries are cleaned up automatically when a task is deleted
  - Thanks to @scztt for reporting

- (#1568) Fixed deleted tasks not being removed from Google Calendar
  - When a task file is deleted outside of TaskNotes (e.g., via Obsidian's file manager), the synced Google Calendar event is now cleaned up automatically
  - The metadata cache `deleted` event's `prevCache` is now forwarded so the calendar event ID can be extracted from the former frontmatter
  - Thanks to @kmaustral for reporting

- Fixed Integrations tab spacing and layout issues
  - OAuth section now shows setup guide link inside the group instead of as a standalone block with an empty heading
  - ICS "Add Subscription" / "Refresh All" buttons now appear above subscription cards
  - Webhooks heading and "Add Webhook" button now appear above webhook cards
  - Auto-export status now displays inside the auto-export group instead of as a detached element
  - Added consistent spacing to calendar and ICS card containers
