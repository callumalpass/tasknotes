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

- (#2712) Made the Task Edit modal and the task card inside a note follow the sort configured in the Relationships Base’s Subtasks view. Thanks to @Glint-Eye for reporting.
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

## Added

- (#2491) Choose a vault time zone so TaskNotes uses the same clock and calendar day across devices. If `mdbase.yaml` has a collection time zone, TaskNotes uses it automatically. See [Vault time zone](https://tasknotes.dev/settings/general/#vault-time-zone). Thanks to @ac8318740 for reporting.

## Changed

- mdbase task types now accept times without an offset in scheduled, due, created and modified fields. New collections record the device’s time zone, and existing collections without a time zone offer to set one.

- (#2705) Reduced startup work for vaults with mdbase type definitions enabled by reusing validation when a type file is unchanged between checks. Thanks to @minchinweb for reporting.
- (#2722) Indexed the task status and priority settings sections in Obsidian settings search so searching for statuses or priorities opens them directly.
- (#2723) Reordering Kanban cards within the same column now shows "Reordered in <column>" instead of a status-change move toast.

## Fixed

- Fixed renaming mapped core properties leaving stale names in `schema.value.required` in the generated mdbase task type, which caused collection and note validation to fail. Existing generated type definitions with stale entries are cleaned up automatically when TaskNotes next syncs the type, while keeping custom required properties. Thanks to the user who reported it.
- (#2691) Moving the next occurrence of a scheduled-anchored recurring task no longer clears completed or skipped history on other dates. Moves without a `recurrence_original_date` (such as Google-synced or legacy off-pattern notes) clear only the landing day when it is already recorded, still behind confirmation; completion-anchored recurring tasks keep clearing recorded instances on or after the new date. See [Recurring Tasks](https://tasknotes.dev/features/recurring-tasks/#rescheduling-and-recorded-instances). Thanks to @martin-forge for reporting.
- (#2706) Fixed mdbase validation of scheduled and due times written by TaskNotes. Existing generated type definitions are updated when TaskNotes loads the vault.
  - Thanks to @iantierney for reporting
- Protect task notes from being emptied by a failed save, including during workflow loops. If TaskNotes cannot restore an empty note, it keeps a recovery copy and includes its location in the error. Thanks to @chrabia for reporting ([Workflows issue 27](https://github.com/callumalpass/tasknotes-workflows/issues/27)).
- (#2703) Apply Paste image rename’s automatic naming when saving a new task with a pasted screenshot, and keep the saved embed linked to that file. Thanks to @ubidev for reporting.
- (#2683) Scrolling up in Agenda and Calendar List now loads earlier days without shifting the visible tasks. Thanks to @Oneiran for reporting.
- (#2698) Dragging an all-day task into the calendar’s timed grid now previews the task’s time estimate. Thanks to @Oneiran for reporting.
- (#2720) Scoped the Ctrl/Cmd+Z undo shortcut to TaskNotes views and the undo toast so it no longer intercepts undo in other Obsidian views. Thanks to @LucDesautels for reporting.
- (#2716) Fixed Agenda and Calendar List views freezing Obsidian for several seconds on every redraw when they show notes placed by a date property. These cards now follow **Show all properties on task cards** like task cards do, fitting properties behind a "+N" count is much faster, and scrolling back to days already loaded no longer reloads the view. Thanks to @Lorite for reporting, measuring the cause and the workaround.
