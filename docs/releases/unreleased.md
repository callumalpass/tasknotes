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

- (#1520) Tag and Context fields in Edit Task modal now show all available suggestions immediately on focus
  - Previously required typing at least one character before suggestions appeared
  - Already-selected values are excluded from the suggestion list
  - Thanks to @Glint-Eye for the suggestion

- (#1506) Added setting to configure the default color for new timeblocks
  - New color picker in Settings > Features > Timeblocking
  - Previously hardcoded to indigo (#6366f1); now user-configurable
  - Thanks to @phillipadsmith for the suggestion

## Fixed

- (#1491) Fixed boolean property values being quoted as strings in Bases filter generation
  - When using a boolean property (e.g. `tasknote: true`) for task identification, the filter now emits unquoted booleans
  - Thanks to @denisgorod for reporting

- (#1494) Fixed Kanban swimlane resetting to "None" on initial load and after navigation
  - Formula-based swimlane properties (e.g. dueDateCategory) were not computed before the first render
  - Added formula computation to KanbanView, matching the existing pattern in TaskListView
  - Thanks to @tnguyen2018 for reporting

- Fixed [mdbase-spec](https://mdbase.dev) type definition generation not triggering when settings change
  - Improved generated `_types/task.md` to use proper multi-line YAML format with field descriptions

- (#1555) Fixed "Folder already exists" error when creating tasks or converting inline tasks
  - Used adapter filesystem check instead of in-memory cache for folder existence
  - Thanks to @jkune5 for reporting

- (#1532) Fixed expanded task modal buttons being cut off when content exceeds viewport height
  - Thanks to @willfanguy for reporting

- (#1542) Fixed declined and cancelled events from ICS calendar subscriptions appearing in calendar view
  - Events with `STATUS:CANCELLED` or an attendee `PARTSTAT=DECLINED` are now filtered out

- (#1556) Fixed completion-based recurring tasks not rescheduling when INTERVAL exceeds 30 (DAILY) or ~12 (WEEKLY)
  - The look-ahead window for finding the next occurrence now scales with the INTERVAL value
  - Thanks to @kazerniel for reporting

- (#1501) Fixed Google/Microsoft Calendar event colors not showing in agenda/list view
  - Per-event and calendar-level colors now display correctly in the list view, matching grid view behavior
  - Added today indicator highlighting to list view day headers, respecting the "Show Today Highlight" setting
  - Thanks to @Robubble for the suggestion
