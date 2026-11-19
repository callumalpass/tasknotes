# Views

TaskNotes provides multiple views for managing tasks and tracking productivity. All task-focused views operate as `.base` files located in the `TaskNotes/Views/` directory and require Obsidian's Bases core plugin to be enabled.


For details on Bases integration and how to enable it, see [Core Concepts](core-concepts.md#bases-integration). For view templates and configuration examples, see [Default Base Templates](views/default-base-templates.md).

## Task-Focused Views

Task-focused views are different entry points into the same underlying task notes. The [Task List View](views/task-list.md) is a common starting view for day-to-day planning because it exposes filters, sorting, and grouping in list format.

Newly generated task Bases open on **Today**. Use **TaskNotes: Open Today** or **TaskNotes: Open Inbox** to select those views in the configured tasks Base. Inbox contains incomplete tasks without a project, due date, or scheduled date. Clear the scheduled date when capturing undated tasks.

Active generated views exclude tasks carrying your mapped archive tag. **Archived** shows archive history, while **All Tasks** retains the complete list. Existing Base files are not rewritten on startup. Use **Update default base files** only when you want to replace the configured templates, and copy customized files first.

New installs show Create task, Tasks, and Calendar in the ribbon. Right-click Obsidian's ribbon to enable Mini calendar, Agenda, Kanban, or Pomodoro. Existing ribbon visibility is retained.

When you want workflow by status, [Kanban View](views/kanban-view.md) organizes cards into columns and can optionally add swimlanes for an extra organizational layer. [Calendar Views](views/calendar-views.md) are useful when schedule and timing matter more than backlog shape, with month/week/day/year/list modes plus drag-and-drop scheduling and time-block support.

[Agenda View](views/agenda-view.md) is a preconfigured list-oriented calendar layout designed for short-horizon planning, while [MiniCalendar View](views/calendar-views.md#mini-calendar-view) gives a compact month heatmap and fast keyboard navigation.

![Task List view](assets/views-tasks-list.png)

![Calendar week view](assets/views-calendar-week.png)

## Keyboard shortcuts

Task List, Kanban, Calendar and Agenda views can be used from the keyboard. Click in a view, or tab into it, then press **?** or select the **Keyboard shortcuts** button in the view's toolbar to see the shortcuts available there.

| Key | Action |
| --- | --- |
| Up/Down or J/K | Move between tasks |
| Left/Right or H/L | Move between columns (Kanban) or days (Calendar) |
| Shift+Up/Down | Extend the selection |
| X | Select or deselect the focused task |
| Mod+A | Select all tasks |
| Escape | Clear the selection |
| Enter | Open the task note |
| E | Edit the task |
| S | Change status |
| P | Change priority |
| D | Change the due date |
| Shift+H | Change the scheduled date |
| T | Change tags |
| C | Create a task |
| / | Search |
| Mod+K | Open the actions palette for the focused or selected tasks |
| Mod+Z | Undo the last change |

Mod is Cmd on macOS and Ctrl elsewhere. When several tasks are selected, property shortcuts change all of them.

Calendar views add **[** and **]** (or **N**) for the previous and next period, and **W** and **M** for the week and month views. When no task is focused, **T** goes to today, **D** switches to the day view, and **P** moves to the previous period.

## Productivity-Focused Views

These views support time management and work tracking.

[Pomodoro View](views/pomodoro-view.md) supports focused intervals directly inside Obsidian. Task time tracking and session history remain available. Version 5 removes the separate Statistics and Pomodoro statistics dashboards; **Open Pomodoro statistics** opens a generated Base instead.

![Pomodoro view](assets/feature-pomodoro-timer.png)

Screenshots in this section are captured via the Playwright docs suite (`npm run e2e:docs`).
