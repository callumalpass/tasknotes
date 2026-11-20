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

- (#2602) Fixed the time range shown while dragging to create a timeblock, task or time entry in the calendar being hidden behind existing events. The selection now draws above existing events, so its time range can be read while dragging over them.
  - Thanks to @RumiaKitinari for reporting
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

- (#2645) TaskNotes retries temporary settings read errors instead of treating an unreadable file as missing. If the file remains unreadable, TaskNotes stops without overwriting it and logs what failed.
  - Thanks to @chrabia for reporting
- (#2643) Fixed task links in [Note Toolbar](https://github.com/chrisgurney/obsidian-note-toolbar) callout toolbars (`> [!note-toolbar]`) breaking the toolbar layout since 5.0. A task link as a toolbar item turned into a narrow card whose title wrapped over several lines and overlapped the next item. Task links in these toolbars now show the task's status and title on one line, as a task link inside a sentence does.
  - Thanks to @hm-24 for reporting
- (#2606) Fixed Ctrl/Cmd-click on a task in Task List, Kanban, Calendar and Agenda views selecting the task instead of opening its note in a new tab. Ctrl/Cmd-click and middle-click now open the note in a new tab on every task card, calendar event and task link in a note, as links do in Obsidian; Ctrl/Cmd+Alt-click opens it to the side. To select several tasks, Shift-click a task first; while a selection is active, Ctrl/Cmd-click adds or removes tasks as before. The task menu again has **Open note in new tab** next to **Open note**, instead of only under **Note actions**. See [Task List view](https://tasknotes.dev/views/task-list/#task-actions).
  - Thanks to @minchinweb for reporting
- (#2641) Fixed tasks in the calendar's Month view not moving when dragged while the calendar is 850px wide or narrower. At that width Month shows tasks as compact chips, and dragging one selected days and opened the create menu instead. The chips can now be dragged to another day, clicked to open the task and right-clicked for the task menu, as in the wider layout. With **Show selected day panel** on, pressing a chip still selects its day.
  - Thanks to @jvvehh-arch for reporting
- (#2618) Fixed the "About default `.base` files" note at the end of the release notes pointing to a General settings page that no longer exists. It now points to **Settings → TaskNotes → Appearance & interaction → Views & base files → Update files** and mentions the **TaskNotes: Update default base files** command.
  - Thanks to @Alireza-RS for reporting
- (#2579) Fixed task links in notes taking extra space on phones in Live Preview. A task link on a checkbox line (`- [ ] [[Task]]`) took three lines (checkbox, task, then the convert button) and now stays on one row, level with the checkbox. When no status or priority is shown, the title no longer starts after an empty gap.
  - Thanks to @BrucePlumb for reporting
- (#2624) Fixed the tops of the Sort, Group, Filter, Properties and Search labels being cut off in the Relationships widget toolbar when the toolbar wrapped onto two lines. The toolbar's header now grows to fit it, in the Relationships widget and in other TaskNotes Bases views.
  - Thanks to @prepare4robots for reporting
- Fixed task rows in the Calendar view's list (Agenda) layout having rounded corners, which curved the divider under each task up at both ends while the divider under a calendar event ran straight. Task rows now have square corners like event rows; task blocks in the day, week and month grids keep their rounded corners.
- Fixed calendar events with a linked note having a grey outline around their whole row in the Calendar view's list (Agenda) layout and the month view's selected day panel, which made the row look selected. The note icon after the title still marks these events; the outline in the calendar grids is unchanged.
