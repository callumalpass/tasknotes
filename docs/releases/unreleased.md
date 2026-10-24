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

## Added

- (#1955) Added Italian interface translations, localized dates and count-aware messages in bundled builds and downloadable language packs. UI language and NLP language remain independent settings.
  - Thanks to @starise for contributing and reviewing the Italian translation.

- Added an opt-in build mode for downloadable interface language packs, with bundled English, validated local caching for offline use, and retry support. Ordinary builds continue bundling all supported languages. Versioned public hosting, a guarded operator publisher, and conditional-create publication tooling are available for experimental builds. Publication rejects permission errors even when identical objects already exist. See [Downloadable language packs](https://tasknotes.dev/development/language-packs/) for build configuration.

## Changed

- The Calendar view now uses TaskNotes' own calendar engine instead of FullCalendar. Existing calendar view settings in `.base` files keep working, including the saved view, custom day count, first day of week, time format, slot range and size, height mode, week numbers, weekends, all-day row, today column width, and event limits.
  - Events update in place when tasks change, and changing a view setting no longer rebuilds the calendar.
  - Long-press drag on touch screens no longer competes with scrolling.
  - Calendar views now work in popout windows.
  - CSS snippets that target FullCalendar's internal classes (such as `.fc-timegrid-slot` or `.fc-daygrid-event`) no longer apply. TaskNotes' own event classes, such as `fc-task-event`, `fc-recurring-event`, `fc-timeblock-event`, `fc-ics-event` and the tag and project classes, are unchanged.
  - The plugin download is about 270 KB smaller.

## Fixed

- (#2414) Fixed Kanban mouse drags aborting on touchscreen laptops while preserving long-press touch dragging. See [Kanban drag-and-drop](https://tasknotes.dev/views/kanban-view/#drag-and-drop-tasks).
  - Thanks to @paladinm078 for reporting and isolating the cause.
- (#2394) Fixed expanded subtasks keeping their previous order after changing a Task List sort when top-level subtasks are hidden. Formula sorts such as `priorityWeight` now refresh already-expanded subtasks. See [Task List](https://tasknotes.dev/views/task-list/). Thanks to @iantierney for reporting this.

- Moved interface translations to Lingui catalogues with count-aware messages, locale-aware numbers and dates, and localized generated Bases labels. Ordinary builds retain all ten bundled interface languages.

- Kept stored default names and reminder descriptions in English, translating unchanged defaults only for display. Restored English `.ics` descriptions and kept persisted Google Calendar metadata in English so exports do not vary with the exporting device’s interface language; user-authored labels are preserved.

- Localized command notices, calendar connection and webhook settings, date/reminder/action/file/timeblock dialogs, task-property pickers, recurrence controls and statistics labels in all nine non-English interface languages. User-authored titles, paths, status labels and property names remain unchanged.

## Removed

## Fixed

- (#2428) Fixed Italian `entro le` deadlines, masculine/feminine scheduled-date expressions and recurring accented weekdays (Monday through Friday).
  - Thanks to @starise for reporting and identifying the causes.

- (#2418) Corrected singular agreement in French, Brazilian Portuguese and Russian count labels and recurrence messages; removed mechanically copied optional French/Spanish plural branches.
- (#2418) Kept Kanban and Task List group keys stable across interface languages so moving or creating tasks in empty and boolean columns does not write translated labels into task properties. Default status and priority labels remain editable and survive saving and reloading.
- (#2418) Rejected title-less natural-language input in interactive task-creation dialogs across interface languages while preserving the existing API, MCP, CLI and instant-conversion fallback behaviour. Kept generated MDBASE schemas in stable English, and corrected literal template braces and missing values in task-created and unresolved-project messages.
- (#2418) Restored translated built-in modal field/group labels and default-label inputs and NLP suggestions. Kept completed-date group sorting and API/MCP group keys stable across languages; viewing translated settings does not overwrite stored names. Task cards and cache-miss edit dialogs now share the same missing-title display fallback.

- (#2421, #2422) Fixed task creation and edit forms closing and discarding input after failed validation or save errors, including edit-modal keyboard saves and the save-before-closing confirmation.
  - Thanks to @andriyor for reporting and contributing the validation fix.
- Prevented stalled language-pack cache reads/writes from leaving language selection and retry stuck, and refreshed ribbon tooltips and accessible names when a preferred language finishes loading after startup.
- Completed Russian and Simplified Chinese calendar attachment and migration messages that still contained English fragments.
- (#1894) Fixed relative date changes (+1/-1 day and week) dropping scheduled and due times from task cards. Date-only tasks remain date-only. See [Task dates](https://tasknotes.dev/features/task-management/#task-dates).
  - Thanks to @gemx-world for reporting.
- (#2140) Fixed edits to visible nested task tags being silently discarded by the task edit modal. Hidden identification tags and the exact task tag remain protected. See [Hide Identification Tags](https://tasknotes.dev/settings/general/#hide-identification-tags).
  - Thanks to @3zra47 for reporting and providing follow-up details.
- (#2148) Empty project, context and tag properties no longer appear or save as literal `"null"` list entries when editing tasks. Unchanged empty and null properties are preserved.
  - Thanks to @minchinweb for reporting this.
- (#2414) Fixed Kanban mouse drags aborting on touchscreen laptops while preserving long-press touch dragging. See [Kanban drag-and-drop](https://tasknotes.dev/views/kanban-view/#drag-and-drop-tasks).
  - Thanks to @paladinm078 for reporting and isolating the cause.
- (#2394) Fixed expanded subtasks keeping their previous order after changing a Task List sort when top-level subtasks are hidden. Formula sorts such as `priorityWeight` now refresh already-expanded subtasks. See [Task List](https://tasknotes.dev/views/task-list/). Thanks to @iantierney for reporting this.
- (#2396) Rescheduling a native virtual recurring task now replaces its original calendar placement without changing later recurrence dates. Completion, skip and Undo retain the original occurrence identity. See [Recurring Tasks](https://tasknotes.dev/features/recurring-tasks/#rescheduling-a-virtual-occurrence).
  - Thanks to @martin-forge for reporting and providing a fresh-vault reproduction.
