# Misc Settings

This page documents settings that do not fit one single workflow category.

## Saved Views Button Position

Controls where the Saved Views button appears in view headers.

- `Right` (default)
- `Left`

Affects Task List, Agenda, Kanban, and Calendar Bases views.

## Status Bar: Tracked Tasks

Shows currently tracked tasks in the Obsidian status bar.

Use this when you want active timer visibility without opening a task view.

## Relationships Widget

Shows or hides the inline relationships widget in notes.

The widget surfaces:

- Subtasks
- Parent project links
- Blocking and blocked-by relationships

## Hide Completed from Overdue

When enabled, completed tasks are not shown in overdue sections even if their dates are in the past.

## Subtask Chevron Position

Controls chevron placement for expandable subtasks.

- Right (default)
- Left (matches group chevrons)

## Disable Note Indexing

Disables indexing of non-task notes to reduce indexing overhead in large vaults.

Trade-off:

- Task workflows remain available.
- Features that rely on non-task note indexing (for example note/date lookups used by note-oriented UI elements) will have reduced functionality.
- Plugin reload/restart is recommended after changing this setting.
