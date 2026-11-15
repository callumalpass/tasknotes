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

- Added **Hide mdbase folders in the file explorer**, enabled by default. Metadata files remain available in search and the quick switcher. New mdbase setups put types, contracts and schemas under `_mdbase/`, with a README. New settings records use `_mdbase/settings/dev.tasknotes.md`; existing `_settings/dev.tasknotes.md` records keep being read and saved there. Existing vaults keep their type and contract folders. See [Integrations](https://tasknotes.dev/settings/integrations/#hide-mdbase-folders-in-the-file-explorer).
- (#2542) Google and Microsoft calendar events shown in TaskNotes calendar views can now be deleted from their right-click menu, after a confirmation. For a recurring event, only the clicked occurrence is deleted. The option is not shown for read-only calendars or ICS subscriptions. See [Calendar Integration](https://tasknotes.dev/features/calendar-integration/#synchronization-behavior).
  - Thanks to @iantierney for the request
- Right-clicking a timeblock on the calendar opens a menu with **Edit timeblock**, **Open daily note**, an item to open each note linked to it, and **Delete timeblock**.

## Changed

- The Google Calendar settings now say more plainly that exporting tasks and timeblocks needs your own Google Cloud project. The connection page is now called **Advanced: use your own Google Cloud project**, and both export pages say what to connect, and where, until it is connected. See [Calendar Integration Setup](https://tasknotes.dev/calendar-setup/#google-calendar).
- On desktop, Task List rows are more compact. In a list at least 640 pixels wide, each task takes a single line, with its properties, dates and priority lined up on the right. In narrower lists the two-line rows are about a third shorter.
- On desktop, the icon buttons on tasks in the Task List, Kanban and calendar lists are all the same 24-pixel square with the same hover. Status, priority and the **⋯** menu were wide ovals, and the other icons had different corners and hover colours. Group headers in the Task List and the collapse buttons on Kanban columns match them.
- On desktop, Kanban cards are shorter: a card with only a title is one line tall. On a board grouped by status, titles no longer leave an empty space where the status would sit.
- Hovering an overdue or due-today date keeps its colour, and the highlight around a date is evenly padded. Hovering a tag, context or project underlines it instead of drawing a box behind it.
- Done tasks show their priority, dates and properties faded, like their title.
- Task List groups start closer to the toolbar, with less space above each group header.
- Clicking a task's priority, due date or scheduled date opens the searchable picker in every view. Outside the Task List and Kanban views, such as in calendar list views and the task cards shown in notes, they opened an older menu.
- Clicking a task's recurrence, on a task or in the task modal, opens a searchable picker with the same presets, **Custom recurrence...** and **Clear**, in place of a menu.
- In the task and batch right-click menus, **Status**, **Priority**, **Tags**, **Due date**, **Scheduled date**, **Recurrence** and **Reminders** open the same searchable pickers as a task's own controls, next to the menu, in place of submenus. **Organization → Contexts** opens the contexts picker. In the batch menu, the +/- day and week options move each selected task's own date. For a recurring task, **Occurrence notes** is its own item in the task menu, no longer inside the Recurrence submenu.
- Right-clicking a note that is not a task in a TaskNotes view or calendar shows a note menu with Open, Open in new tab, Open to the right, Convert to task, Rename, Obsidian's file items and Delete. It had only Obsidian's file items.
- The task menu's **Note actions** submenu lists TaskNotes' items first with Obsidian's alongside them, adds **Open to the right**, and no longer repeats **Copy path** or offers a second **Show in file explorer**. **Delete** is last and shown in red.
- In the task modal and the task right-click menu, **Reminders** opens a searchable picker: quick reminders before the due and scheduled dates, with the ones already set ticked, then **Manage all reminders...** and **Clear all reminders**.
- Deleting a task or note happens straight away, without a confirmation, and the notice that follows offers **Undo**, which puts the note back at the same path. This applies to the right-click menus, **Delete** in the task modal and the action palette, and deleting several selected tasks at once. The note still goes to the trash that Obsidian is set to use.
- Deleting a timeblock from the calendar happens straight away, and **Undo** in the notice that follows restores it, unless the daily note has changed since.
- **Postpone overdue scheduled tasks to today** no longer asks for confirmation. The notice that follows still offers **Undo**.
- In the Task List, the **Move task** handle opens a searchable list in place of a menu: **Add as subtask of…**, **Move up** and **Move down**, then every group the task can move to, with subgroups listed as *Group / Subgroup*. Type a group's name to filter it.
- Right-clicking works the same way in every view. Shift+right-click adds the task to the selection and opens the batch menu, and right-clicking any task while several are selected adds it to the selection and opens the batch menu. On the calendar, Shift+right-click did nothing extra, and only a task that was already selected opened the batch menu. Recurring tasks and tracked time on the calendar still open their own menu.

## Removed

- The batch right-click menu no longer has **Clear tags**. To remove tags from the selected tasks, untick them in the **Tags** picker.

## Fixed

- Right-clicking a recurring task's Kanban card, outside its **⋯** button, acts on the card's occurrence. It acted on today's, so **Mark complete** could complete the wrong occurrence.
- Choosing an after-completion rule through **Custom recurrence...** in the task right-click menu saved the rule but not that it repeats after completion.
- While editing a task, quick reminders and **Clear all reminders** were written to the note straight away, so cancelling the edit did not undo them. They are now saved with the rest of the task.
- The status and priority pickers list values in the order shown in Settings. The priority picker could list them in reverse, for example with the default priorities it put **None** first and **High** last.
- When tasks are identified by a tag, the tags picker no longer lists that tag, so it can no longer be unticked by mistake. Unticking it made the note stop being a task.
