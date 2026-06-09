# Canvas Bases

Canvas Bases is the TaskNotes canvas companion plugin for Obsidian Bases and Canvas. It turns the current Bases result set into a canvas-style board, either as a live Bases layout named **Canvas Bases** or as a generated JSON Canvas snapshot.

Canvas Bases works with normal notes and with TaskNotes task notes. Bases remains the source for which notes appear: filters, sorting, grouping, formulas, and visible properties all come from the `.base` file. Canvas Bases handles spatial layout, cards, edges, zones, pinned notes, text cards, and linked canvas updates.

## Requirements

- Obsidian 1.10.1 or newer.
- The Obsidian Bases core plugin.
- The Obsidian Canvas core plugin when opening or editing generated `.canvas` files.
- TaskNotes is optional, but must be installed and enabled for TaskNotes-specific badges, task menus, dependency edges, subtasks, time tracking, Pomodoro actions, and recurring-task zone actions.

If TaskNotes is disabled, Canvas Bases still works as a Bases and Canvas plugin. TaskNotes-specific actions are skipped when TaskNotes is absent or does not expose the required runtime API capability.

## When to Use Canvas Bases

Use Canvas Bases when a task view benefits from spatial arrangement instead of a list, table, calendar, or Kanban column set.

Common uses include:

- Planning project tasks on a visual board.
- Seeing dependencies or related notes as edges between cards.
- Embedding a board in a daily note, project note, or meeting note.
- Turning a filtered Base view into a reusable `.canvas` snapshot.
- Grouping notes with Bases, then manually arranging the result.
- Dropping cards into assignment zones to update a note property or run a supported TaskNotes action.

If the question is only "which tasks should appear?", keep that in Bases filters, formulas, sorting, and grouping. Canvas Bases is for visualizing and arranging the current Bases result set.

## Canvas Bases Layout

After Canvas Bases is installed, open or create a `.base` file and add a view using the **Canvas Bases** layout.

In the live layout:

- Each Base result row becomes a file card.
- Displayed Base properties appear on each card in the same order as the Base properties menu.
- Base groups become group frames.
- Cards and group frames can be dragged and resized.
- Ungrouped views place cards directly on the board.
- The initial card order follows the Base sort order.
- Inline note-body editing is available when **Show body editor** is enabled.
- Board controls support panning, zooming, fit view, reset view, and opening cards.
- Manual notes, manual groups, and text cards can be added without changing the Base query.

Canvas Bases stores layout and board state in Canvas Bases-owned keys in the `.base` view config. It does not need to rewrite the core query just to remember card positions, sizes, colors, pinned notes, text cards, zones, or the linked canvas path.

## Materialize a Canvas

Canvas Bases can also create or update a JSON Canvas file from any active Bases view, including native and third-party Bases layouts.

Run these commands from the command palette:

```text
Canvas Bases: Create canvas from current bases view
Canvas Bases: Update linked canvas
Canvas Bases: Open linked canvas
```

The create command asks for the canvas path, layout, edge options, node size, and update behavior. Canvas Bases-owned node and edge IDs are stable, so updating a linked canvas can preserve existing Canvas Bases node positions and keep unrelated manual Canvas nodes and edges.

The generated `.canvas` file is a snapshot, not a live query. Re-run **Canvas Bases: Update linked canvas** after changing the Base result set or board layout.

## TaskNotes Integration

Canvas Bases reads TaskNotes through the [TaskNotes JavaScript Runtime API](../javascript-api.md). It feature-detects API capabilities before using them, so the board can degrade cleanly when TaskNotes is unavailable or a capability is missing.

When TaskNotes integration is enabled, Canvas Bases can:

- Show TaskNotes status, priority, planning, recurrence, blocked, blocking, subtask, time estimate, tracked time, and active tracking badges on task cards.
- Add TaskNotes task actions to card context menus through the TaskNotes task menu API.
- Draw dependency edges between visible tasks.
- Draw dependency and parent-subtask edges when the TaskNotes relationship mode is set to `all`.
- Add or remove dependency and subtask relationships by dragging from one card's link handle to another.
- Update mapped TaskNotes task properties when a card is dropped into a property zone.
- Run supported zone actions such as complete, uncomplete, archive, unarchive, start or stop time tracking, start or assign a Pomodoro, complete an occurrence, or skip an occurrence.

TaskNotes remains responsible for task semantics. Canvas Bases asks TaskNotes to read and mutate tasks instead of editing task frontmatter directly.

## Edges and Relationships

Canvas Bases can draw edges when both endpoint notes are present on the board.

Supported edge sources include:

| Source | What it uses |
| --- | --- |
| `wikilinks` | Links found in the note body. |
| `properties` | Links stored in configured note properties. |
| `all` | Wikilinks and configured property links. |
| TaskNotes dependencies | Blocking relationships from TaskNotes. |
| TaskNotes subtasks | Parent-child task relationships from TaskNotes when enabled. |

For property edges, configure a comma-separated list of property names, such as:

```text
depends_on, related
```

Edges can be opened from their context menu. Removable TaskNotes and property relationships can also be removed from that menu.

## Assignment Zones

Assignment zones are board regions that do something when a card is dropped into them.

The default zone action updates a note property. A grouped Canvas Bases view can turn Bases groups into zones, so dragging a card into another status, priority, or custom-property group writes that property value back to the note.

Custom zones can update another note property or run supported TaskNotes actions. This lets a board mix automatic Bases-derived groups with manual workflow areas such as review queues, time-tracking lanes, or Pomodoro focus zones.

## Files and Data

Canvas Bases keeps user data in normal vault files:

| Data | Where it lives |
| --- | --- |
| Task and note content | Markdown files. |
| Query, visible properties, sorting, and grouping | `.base` files. |
| Live board geometry and Canvas Bases options | Canvas Bases-owned keys in the `.base` view config. |
| Generated board snapshots | `.canvas` files. |
| Options for non-Canvas Bases active views | Canvas Bases plugin data. |

Manual non-Canvas Bases nodes in a generated `.canvas` file are preserved when Canvas Bases updates that canvas.

## First Board

A practical first Canvas Bases setup is:

1. Create or duplicate a TaskNotes `.base` view.
2. Filter it to the tasks or notes you want on the board.
3. Add a Canvas Bases layout view to that `.base` file.
4. Choose which properties to show on cards.
5. Enable TaskNotes badges, actions, or relationships if the board is task-focused.
6. Arrange the cards and groups.
7. Use the toolbar to create a linked `.canvas` snapshot when you want a Canvas file.

Canvas Bases can also create starter files under `Canvas Bases/` with a demo Base, sample notes, and a linked Canvas path. Run **Canvas Bases: Create starter files** from the command palette if you want a small example board to inspect before adapting your own TaskNotes views.
