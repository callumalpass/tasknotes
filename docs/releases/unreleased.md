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

- The **Icon** field for statuses and priorities suggests Lucide icons as you type, with a preview of the chosen icon.
- (#2436) Added **Use default projects only when no project is specified** under Settings → Task creation → Defaults → Default projects. When it is on, a project you pick or type while creating a task replaces your default projects instead of being added to them, and instant conversion leaves out the defaults when the text names a project. Off by default. See [Task Properties](https://tasknotes.dev/settings/task-properties/).
  - Thanks to @RumiaKitinari for the request
- **TaskNotes: Open Pomodoro statistics** opens a generated Pomodoro statistics Base, `TaskNotes/Views/pomodoro-stats.base`. Its Daily view shows completed, attempted and interrupted Pomodoros, focus time, completion rate and breaks for each day, and its Monthly view totals them by month. It counts sessions stored in daily notes, not sessions kept in `data.json`. TaskNotes creates the file if it is missing. You can change its path under Settings → TaskNotes → Appearance & interaction → Views & base files. See [Pomodoro statistics Base](https://tasknotes.dev/features/time-management/#pomodoro-statistics-base).
- (#1147) The Pomodoro view has a **Recent sessions** list under the timer with your last ten work sessions. Each row has a delete button, so you can remove a session recorded by mistake, such as one left running overnight. Deleting a session does not change the task's time entries. See [Pomodoro View](https://tasknotes.dev/views/pomodoro-view/#recent-sessions).
  - Thanks to @RumiaKitinari for reporting and @BrucePlumb for the follow-up

## Fixed

- In the Task List, a task's tags no longer run together into one tag (for example "taskwork") when the view shows the `file.tags` property, as the default Tasks view does.
- The mini calendar's day list no longer shows "00:00" for tasks that have a date but no time. This happened when the view's date property had no `note.` prefix, as in the default mini calendar views.
- With **Pomodoro data storage** set to Daily notes, a finished session is no longer lost when the daily note can't be created or the Daily notes plugin is off. It is saved to `data.json` and still appears in your history.
- On phones and other narrow panes, the mini calendar's day list no longer runs into the edge of the screen.
- (#2267) With **Include Obsidian link** on, Google Calendar event descriptions for tasks and timeblocks show a clickable "Open in Obsidian" link again, instead of the `obsidian://` address as plain text. Existing events get the link the next time the task or timeblock is synced. Thanks to @techy-robot for reporting.
- Fixed task completion events connecting to the published mdbase plugin (`mdbase-sync`) when **Allow plugin integrations** is enabled. Unsupported bridge API versions are ignored.
- Fixed long Task Lists leaving the bottom of the list blank after a large jump with the scrollbar. The missing rows appeared only after scrolling again.
- (#2526) On phones, the Agenda, Calendar and Kanban views no longer extend under Obsidian's bottom navigation bar, so the last tasks can be seen. These views now use the same bottom spacing as Obsidian's own Bases views. The Task List uses it too, in place of a fixed gap, and embedded views are unchanged.
  - Thanks to @Jomo94 for reporting.
- (#2263) The last task in the Task List and Agenda can now be scrolled clear of the status bar on desktop.
  - Thanks to @3zra47 for reporting.
- (#2559) Fixed clicking a task's status in a Bases view when the note is included by the view's filter but not identified as a task by TaskNotes' task identification settings (for example, a view filtered on `type: task` while TaskNotes identifies tasks by tag). Recurring tasks failed with "Failed to execute 'structuredClone' on 'Window'", and other tasks showed "Task not found". Both now update. Saving the Undo for a recurring completion no longer copies view data, and if Undo cannot be prepared the completion still saves.
  - Thanks to @0x326-CHR for reporting

## Changed

- The plugin's `main.js` is about 295 KB smaller (4.9 MB to 4.6 MB). The Google Calendar sign-in client no longer bundles validation code TaskNotes never uses, including error messages for every language.
- TaskNotes follows more of your theme's styling:
  - Selected tasks use the same highlight as selected files in Obsidian.
  - Keyboard focus outlines use the same colour as Obsidian's own controls.
  - Date and time chips in timeblock dialogs, and priority chips when scheduling unscheduled tasks, use Obsidian's pill style.
  - Menus, pickers, notifications, buttons, and board and group headers use Obsidian's interface text sizes. They no longer grow with the reading font size, and they use Obsidian's larger sizes on mobile.
  - Text no longer goes below 12px.
  - The search field in TaskNotes views uses Obsidian's form field background.
  - A few remaining fixed shadows now come from the theme.
- Task rows in lists and boards are tidier:
  - Priority sits at the end of the title line on every row, so priorities line up down the list. It no longer moves under the status icon on rows that have a date. On very narrow cards (240px or less), priority moves under the status icon and the dates use the full width of the card.
  - The default priority mark is a dot in the priority's colour, instead of signal bars. Priorities with a custom icon still show that icon. So that priorities differ by more than colour, the highest-weighted priority has a ring around its dot and the lowest-weighted one has a smaller dot.
  - A faint dot separates the items on a task's second line: dates, tags, contexts, projects and any other properties you show. Tags no longer run into the date before them.
  - With a mouse, reminder, recurrence, dependency and other indicator icons sit on the title line next to the priority, as other indicators already did. The second line keeps its full width for dates and properties. On touch screens these icons stay on the second line.
  - On mobile and other touch screens, task rows are shorter (about 72px instead of 96px for a row with a date). The status, priority and menu buttons are 32px, and dates, tags and indicator icons on the second line are 24px. Previously both lines were 40px tall, which left a wide gap between a task's title and its dates. On mobile, the dots between tags and other list items are now evenly spaced.
  - The in-progress status icon has a smaller fill inside the ring, so it no longer outweighs high-priority rows.
  - Scheduled dates no longer show a calendar icon in task rows. Due dates keep their flag, so a plain date is the scheduled date.
  - Rows in the Task List have the same space on both sides of the pane.
  - A recurring task shows one recurrence icon. Cards that show the recurrence indicator on the title line no longer also show the recurrence property on the second line.
  - In a task note, the task card's tags are plain text like the rest of the card's second line, as on board cards, instead of coloured tag pills.
- The mini calendar's day list shows tasks like task rows: the status icon before the title and the priority after it. Tasks without a priority show no priority mark, and long titles end with "…".
- In calendar month views, timed tasks show the time first and then the title, which can use the rest of the cell. Status and priority icons are no longer shown in month cells.
- Boards in a note's relationships panel show only the columns that have tasks. Set **Hide empty columns** on the view to change this. New relationships base files set this option for the Subtasks and Blocking boards.
- In the task dialog, the Contexts, Tags and Time estimate fields show "Add contexts", "Add tags" and "Add estimate" when empty, instead of example values. When the full form is open, the task's projects appear only in the Projects field, not also as a chip in the property row. The "Time estimate (minutes)" field is now labelled **Time estimate**, with "min" after the value.
- Dragging tasks in the task list shows less on screen:
  - A small chip with the task's title follows the pointer instead of a full copy of the row. A second line in the chip says what dropping there will do, or why you can't drop there.
  - The "Add as subtask" target is now an icon at the end of the row, so it no longer covers the title of the task you're dropping onto. Over it, the parent row is highlighted and an indented line marks where the subtask will go.
  - The separate floating message next to the pointer is gone. Its text is now in the chip, and "Other projects stay unchanged" was removed.
  - The keyboard focus outline is hidden while dragging, so it can't be mistaken for the drop target.
- New installs store Pomodoro sessions in daily notes, in the `pomodoros` property of each day's note, instead of the plugin's `data.json`. If daily notes are off or the day's note can't be created, the session is saved to `data.json` and still counts in your history. Existing setups keep their current storage. The **Pomodoro data storage** setting now describes this fallback. See [Recorded data](https://tasknotes.dev/features/time-management/#recorded-data).

## Removed

- Removed the Statistics and Pomodoro statistics views again, with the **Open task & project statistics** command. Version 5.0.0-beta.5 removed them, but later betas brought them back. Time tracking, the Pomodoro timer and recorded sessions are unchanged. TaskNotes closes any statistics tabs left in your workspace. The Pomodoro view's "completed today" count no longer opens the statistics view. **Open Pomodoro statistics** now opens the Pomodoro statistics Base instead, and sessions are deleted from **Recent sessions** in the Pomodoro view. To total tracked time by project, see [Time by project with Bases](https://tasknotes.dev/features/time-management/#time-by-project-with-bases).

## Security
