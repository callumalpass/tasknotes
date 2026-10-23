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

- (#1894) Fixed relative date changes (+1/-1 day and week) dropping scheduled and due times from task cards. Date-only tasks remain date-only. See [Task dates](https://tasknotes.dev/features/task-management/#task-dates).
  - Thanks to @gemx-world for reporting.
- (#2140) Fixed edits to visible nested task tags being silently discarded by the task edit modal. Hidden identification tags and the exact task tag remain protected. See [Hide Identification Tags](https://tasknotes.dev/settings/general/#hide-identification-tags).
  - Thanks to @3zra47 for reporting and providing follow-up details.

- (#2414) Fixed Kanban mouse drags aborting on touchscreen laptops while preserving long-press touch dragging. See [Kanban drag-and-drop](https://tasknotes.dev/views/kanban-view/#drag-and-drop-tasks).
  - Thanks to @paladinm078 for reporting and isolating the cause.
- (#2394) Fixed expanded subtasks keeping their previous order after changing a Task List sort when top-level subtasks are hidden. Formula sorts such as `priorityWeight` now refresh already-expanded subtasks. See [Task List](https://tasknotes.dev/views/task-list/). Thanks to @iantierney for reporting this.
- (#2396) Rescheduling a native virtual recurring task now replaces its original calendar placement without changing later recurrence dates. Completion, skip and Undo retain the original occurrence identity. See [Recurring Tasks](https://tasknotes.dev/features/recurring-tasks/#rescheduling-a-virtual-occurrence).
  - Thanks to @martin-forge for reporting and providing a fresh-vault reproduction.
