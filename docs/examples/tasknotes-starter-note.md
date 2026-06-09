# Start Here with TaskNotes

This note is a small tour of TaskNotes inside your own vault. Work through it in place, then keep it as a reference or delete it when you no longer need it.

TaskNotes works best when three things feel connected:

1. Capture a task quickly.
2. Store the task as a normal Markdown note.
3. Review tasks through Bases views.

## Before you start

- [ ] Enable the Obsidian **Bases** core plugin.
- [ ] Confirm TaskNotes has created the default `.base` files in `TaskNotes/Views/`.
- [ ] Open the command palette and run **TaskNotes: Open tasks view**.

TaskNotes creates missing default `.base` files automatically on startup when **Auto-create default files** is enabled. If the files are missing, use **Settings -> TaskNotes -> General -> Views & base files -> Create files**.

## 1. Create a task from the command palette

Run **TaskNotes: Create new task** and create a real task you intend to do soon.

Try a title like:

```text
Review my TaskNotes setup tomorrow #admin
```

After saving, TaskNotes creates a Markdown note for that task. Open the task note and look at the YAML properties at the top. Those properties are what Bases reads for filtering, sorting, grouping, and calendar placement.

## 2. Convert inline tasks into TaskNotes

The checkboxes below are ordinary Markdown tasks. Convert each one into a TaskNote from the line's inline action or the command palette.

- [ ] Create a TaskNotes inbox task due tomorrow #admin
- [ ] Schedule a 20 minute planning task for next Monday #planning
- [ ] Make a task linked to an active project note

After conversion, notice a few things:

- The source line can stay in this note as context.
- The actual task now lives as its own Markdown note, so it can appear in TaskNotes views.
- The converted line links to the TaskNote. Right-click that TaskNote link to open the task menu, then try changing a property such as status, priority, due date, scheduled date, or project.

## 3. Review your tasks

The embedded views below use the default TaskNotes Bases files.

### Task list

![[TaskNotes/Views/tasks-default.base]]

Use this when you want a straightforward list of everything open.

### Agenda

![[TaskNotes/Views/agenda-default.base]]

Use this when you care about due dates, scheduled dates, and what needs attention soon.

### Mini calendar

![[TaskNotes/Views/mini-calendar-default.base]]

Use this when you want a compact calendar alongside your notes.

### Calendar

![[TaskNotes/Views/calendar-default.base]]

Use this when you want a larger calendar for scheduled work, due dates, timeblocks, and calendar events.

### Kanban

![[TaskNotes/Views/kanban-default.base]]

Use this when you want to move work through statuses like open, in progress, and done.

## 4. Adjust only what gets in your way

The defaults are enough to start. Visit settings later when you know what you want to change:

- If task files are going to the wrong place, check **Settings -> TaskNotes -> General**.
- If converted inline tasks should be created somewhere else, check **Settings -> TaskNotes -> Inline Task Settings**.
- If the task modal shows too much or too little, check **Settings -> TaskNotes -> Modal Fields**.
- If your vault uses different property names, statuses, priorities, or custom fields, check **Settings -> TaskNotes -> Task Properties**.

## 5. Make it yours

Try adding one custom property to a task, such as `energy`, `client`, or `area`. Because tasks are Markdown notes, custom properties can be used in Bases without locking you into a separate task database.

## 6. Contextual views

You can embed Bases views inside daily notes, project notes, meeting notes, or task notes. Advanced Bases filters can use the current note as context, so one view can show tasks related to whatever note it is embedded in.

TaskNotes uses this pattern for the Relationships widget in task notes. When you are ready to customize views, see the TaskNotes documentation for examples.

Useful next experiments:

- Duplicate `TaskNotes/Views/tasks-default.base` and make a view for one project.
- Add a group to a Base view, such as status or priority.
- Add a filter for tasks due this week.
- Link a task to a project note and use backlinks to see where it is mentioned.

## More help and extensions

- Documentation: [tasknotes.dev](https://tasknotes.dev/)
- Problems or bugs: [open an issue on GitHub](https://github.com/callumalpass/tasknotes/issues)
- Companion plugins:
  - [Canvas Bases](https://tasknotes.dev/companion-plugins/canvas-bases/) adds canvas-style boards and JSON Canvas snapshots for Bases views, with optional TaskNotes badges, actions, and relationship edges.
  - [TaskNotes Workflows](https://tasknotes.dev/companion-plugins/tasknotes-workflows/) adds Markdown-defined automation for TaskNotes events, schedules, manual commands, and task actions.

## Finished

Now you know the core idea: tasks are notes, properties make them queryable, and Bases turns them into views.
