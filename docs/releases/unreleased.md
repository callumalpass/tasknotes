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

## Fixed

- (#2604) Fixed the task card in a narrow Pomodoro view (about 350 px wide or less) running the title under the status and priority icons. On narrow task cards in any view, the due-date icon could also sit on its own line above the date. It now stays beside the date. Turn on **Show all properties on task cards** to show time estimate and time tracked on extra lines instead of in a count such as +2.
  - Thanks to @RumiaKitinari for reporting
- (#2613) Fixed status and priority icons not lining up with the task title. In a wide Task List the priority icon sat slightly higher than the title, and when a title wrapped onto several lines with nothing below it, both icons sat between its lines. They now line up with the first line of the title in Task List, Kanban, Agenda and Pomodoro views.
  - Thanks to @wivi-prod for reporting
