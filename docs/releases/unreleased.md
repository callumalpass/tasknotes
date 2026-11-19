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

- (#2615) Added **Hide top-level subtasks** to the Calendar view's list (Agenda) layout and the month view's selected day panel, as in Task List and Kanban. When on, a subtask whose parent task is listed on the same day shows only under the parent's expanded subtasks instead of also as its own row. A subtask whose parent isn't listed that day keeps its own row. See [Agenda View](https://tasknotes.dev/views/agenda-view/#customization).
  - Thanks to @tistieom for the request

## Fixed

- (#2606) Fixed Ctrl/Cmd-click on a task in Task List, Kanban, Calendar and Agenda views selecting the task instead of opening its note in a new tab. Ctrl/Cmd-click and middle-click now open the note in a new tab on every task card, calendar event and task link in a note, as links do in Obsidian; Ctrl/Cmd+Alt-click opens it to the side. To select several tasks, Shift-click a task first; while a selection is active, Ctrl/Cmd-click adds or removes tasks as before. The task menu again has **Open note in new tab** next to **Open note**, instead of only under **Note actions**. See [Task List view](https://tasknotes.dev/views/task-list/#task-actions).
  - Thanks to @minchinweb for reporting
- (#2618) Fixed the "About default `.base` files" note at the end of the release notes pointing to a General settings page that no longer exists. It now points to **Settings → TaskNotes → Appearance & interaction → Views & base files → Update files** and mentions the **TaskNotes: Update default base files** command.
  - Thanks to @Alireza-RS for reporting
