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

## Changed

- (#2381) Task List group and subgroup moves no longer require manual-order sorting. Drops preview the properties they will change, while reordering uses a separate insertion line. The movement handle also offers a destination menu, and ordinary property moves have an Undo action that preserves later unrelated edits. A separate **Add as subtask** drop target assigns another task as a parent without replacing existing project memberships or changing group values or manual rank; self-assignment and cycles are blocked. Moves between list-property groups show the full list before and after, releasing a drag on its original row cancels it, and the handle menu offers **Move up** and **Move down** when the view is manually sorted. Thanks to @iantierney for the suggestion. See [Task List](https://tasknotes.dev/views/task-list/).

## Removed

## Fixed

- (#2408) Localized the Modal Fields settings controls, field-card labels and type badges, notices, and reset confirmation. Saved field and group names remain unchanged. Thanks to @whysoslow for contributing this fix.

- Kanban drops into the empty ("None") column now clear the grouping property instead of writing the text "None", and dropping onto a list-valued column no longer overwrites the list when the task's source column is unknown.

- Manual reordering in Task List and Kanban views sorted by manual order in descending direction now places a task on the correct side of its neighbour when the group contains only one other task.
