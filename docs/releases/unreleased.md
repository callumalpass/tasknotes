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

- (#2606) Fixed Ctrl/Cmd-click on a task in Task List, Kanban, Calendar and Agenda views selecting the task instead of opening its note in a new tab. Ctrl/Cmd-click and middle-click now open the note in a new tab on every task card, calendar event and task link in a note, as links do in Obsidian; Ctrl/Cmd+Alt-click opens it to the side. To select several tasks, Shift-click a task first; while a selection is active, Ctrl/Cmd-click adds or removes tasks as before. The task menu again has **Open note in new tab** next to **Open note**, instead of only under **Note actions**. See [Task List view](https://tasknotes.dev/views/task-list/#task-actions).
  - Thanks to @minchinweb for reporting
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

## Changed

- (#2608) A recurring task whose `COUNT` or `UNTIL` series has ended now counts as completed. Completing or skipping its last occurrence sets the task to your first completed status, and auto-archive applies to it as it does to other tasks in that status; reopening an occurrence reopens the task. Series without a limit are unchanged and still never auto-archived. An existing ended series is archived once you set it to an auto-archive status. See [Recurring Tasks](https://tasknotes.dev/features/recurring-tasks/#when-a-series-ends).
  - Thanks to @14790897 for the suggestion
