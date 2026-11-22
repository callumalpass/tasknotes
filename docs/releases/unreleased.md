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

- Updated task-card keyboard actions and shortcut settings for TaskNotes 5.0.1. The actions use the current property and recurrence pickers, and shortcut labels use the Lingui translation catalogs.

## Fixed

- Fixed Task List's `x` selection shortcut targeting the last clicked task after the mouse hovered another task, including after a selection rerender. The selection count now overlays the list without moving task cards.
- Restored task view shortcuts for projects, contexts, tags, and deleting tasks, along with other fork actions that were disconnected from the Bases keyboard handler.
- Restored a remove button for each assigned project in the project picker, including when only some selected tasks have the project.
- Fixed Task List selection checkboxes appearing below the status indicator, removed the fork's indicator outlines, and restored opening or editing a task when its row is clicked while batch selection is active. The checkbox remains the plain-click selection control.
