# Bulk Tasking

[← Back to Features](../features.md)

TaskNotes lets you create, convert, and edit tasks in batch from any [Bases](https://help.obsidian.md/bases) view. The bulk tasking modal has three modes, each designed for a different workflow. You can also bulk-task files directly from the file explorer.

<!--
Recording Script
SETUP:
  cd .obsidian/plugins/tasknotes
  node scripts/generate-test-data.mjs --clean   # or: bun run generate-test-data:clean
  Reload plugin in Obsidian

Use: TaskNotes/Demos/Bulk Generate Demo.base, Bulk Convert Demo.base, Bulk Edit Demo.base
Show bulk tasking across the regular table view
Show isTask true
Show looking at non-TN notes in Bulk Convert Demo
Show bulk convert then how it adds bulk task data
Show bulk generate from document library
Show bulk edit changing priority/due on multiple tasks

CLEANUP (bulk ops create/modify files):
  node scripts/generate-test-data.mjs --clean   # or: bun run generate-test-data:clean
-->

Open the modal by clicking the **Bulk tasking** button in any Bases view toolbar, or by right-clicking files or folders in the file explorer.

The modal shows the items from the current view (or selection) and lets you pick a mode using tabs at the top: **Generate new tasks**, **Convert to tasks**, or **Edit existing tasks**. A fourth tab, **Base view defaults & settings**, appears when the modal is opened from a Bases view.

## Generate Mode

Generate mode creates a new task file for each item in the view. The source items stay unchanged. This is useful when you have a list of notes (meeting notes, project plans, reference documents) and want to spin off tasks linked back to them.

<!-- GIF: Opening the bulk modal from a Bases view, selecting Generate mode, and creating tasks -->

Each generated task:

- Gets its own Markdown file in your configured task folder
- Links back to the source note via the `projects` property (a wikilink to the original file)
- Inherits any bulk values you set in the action bar (status, priority, dates, assignees, reminders, custom properties)

**Options:**

| Option | Default | What it does |
|--------|---------|--------------|
| Skip existing | On | If a task already links to a source note, skip it instead of creating a duplicate |
| Link to source | On | Add the source note as a wikilink in the new task's `projects` field |

The engine processes items in parallel (batches of 5) for speed, with a progress bar showing how many have been created.

## Convert Mode

Convert mode turns existing notes into tasks without creating new files. It adds task identification metadata (a frontmatter property or tag, depending on your settings) and optionally sets default values for status, priority, and creation date. The note's existing content and frontmatter are preserved.

<!-- GIF: Switching to Convert mode, seeing compatibility check, and converting notes into tasks -->

What Convert does to each note:

1. **Adds task identification** -- sets the property you configured in settings (e.g., `task: true`) or adds your task tag
2. **Applies defaults** (optional) -- sets status, priority, and `dateCreated` if they are not already present
3. **Sets the creator** (optional) -- auto-attributes the task to the current device's person note if device identity is configured
4. **Links to the view** (optional) -- adds the `.base` file as a project link
5. **Never overwrites** -- existing frontmatter values are left untouched; only missing fields are added

**Options:**

| Option | Default | What it does |
|--------|---------|--------------|
| Apply defaults | On | Set status, priority, and dateCreated on notes that do not already have them |
| Link to base | On | Add the `.base` file as a wikilink in the `projects` field |

Before running, Convert shows a compatibility check: how many items are already tasks (will be skipped), how many are non-Markdown files (will be skipped), and how many will be converted.

## Edit Mode

Edit mode modifies frontmatter properties on files that are already tasks. Unlike Convert, it overwrites existing values with whatever you set. Files that are not tasks are skipped.

This is useful for batch updates: reschedule 20 tasks to next week, change the priority on everything in a view, or assign a group of tasks to someone.

<!-- GIF: Using Edit mode to batch-update priority and due date on multiple tasks -->

**Behavior:**

- Only files that are already identified as tasks are edited
- Only fields you explicitly set are written -- blank fields in the action bar are left untouched on the target files
- Non-Markdown files and non-task files are skipped with a count shown in the pre-check

## The Action Bar

All three modes share an action bar at the top of the modal. It contains icon buttons for the most common task properties:

<!-- SCREENSHOT: Action bar with icons for due, scheduled, status, priority, reminders, assignee -->

| Icon | Property | Picker |
|------|----------|--------|
| Calendar | Due date | Date picker with relative options (Today, Tomorrow, Next week, etc.) |
| Calendar clock | Scheduled date | Date picker |
| Circle | Status | Dropdown with your configured statuses |
| Flag | Priority | Dropdown with your configured priorities |
| Bell | Reminders | Reminder editor (stackable -- you can add multiple reminders) |
| User | Assignee | Person and group picker |

Each icon shows a dot indicator when a value is set, and the tooltip updates to show the current value. For reminders, the dot shows a count badge.

If you set reminders but no dates, a warning appears -- relative reminders need a date to anchor to.

Values set in the action bar apply to every item in the batch. In Generate mode they are written to the new task files. In Convert mode they are added only if the field is missing. In Edit mode they overwrite the existing value.

## Custom Properties in Bulk Operations

Below the action bar, a **Properties & Anchors** section lets you add any frontmatter property to the batch. It uses the same PropertyPicker that appears in individual task modals.

<!-- SCREENSHOT: PropertyPicker in bulk modal showing discovered properties with type badges -->

Type a property name or search existing properties discovered from your task files. The picker shows:

- Property names with type badges (text, number, date, list, link)
- A "Map to" option that lets you assign a custom property to a standard task field (e.g., map `deadline` to the due date slot)
- Properties already set in the batch, shown as editable rows below the picker

Custom properties are written to frontmatter alongside the standard task fields. In Generate and Convert modes they are added. In Edit mode they overwrite.

If the view you opened from has per-view field mappings configured, those mappings are pre-loaded into the Properties & Anchors section automatically.

## Duplicate Detection

In Generate mode, TaskNotes checks for existing tasks that already link to each source note before creating new ones. This prevents accidental duplicates when you run bulk generation more than once.

The detection works by scanning the `projects` field on all existing tasks:

- Compares wikilinks (`[[Note Name]]`) and Markdown links (`[text](path)`)
- Matches on full path or basename (handles vault reorganization)
- Case-insensitive comparison

If the **Skip existing** toggle is on (the default), items with existing linked tasks are skipped and counted separately in the results. You can turn this off if you intentionally want multiple tasks per source note.

## Universal Bases View Buttons

TaskNotes adds **New task** and **Bulk tasking** buttons to every Bases view toolbar, not just TaskNotes-registered view types. This means Table, Board, and any other native Bases view gets TaskNotes controls automatically.

<!-- GIF: TaskNotes "New task" and "Bulk tasking" buttons appearing on a native Bases Table view -->


The buttons appear next to Obsidian's built-in "New" button. They use the same styling as native toolbar items so they blend in.

??? info "How it works"

    A `MutationObserver` watches for new Bases toolbars appearing in the DOM. When a toolbar is detected, TaskNotes checks whether it belongs to a TaskNotes-registered view (which injects its own buttons) or a native view. Native views get the universal buttons injected. If a view switches from a native type to a TaskNotes type, the universal buttons are automatically removed to avoid duplicates.

**Per-view control:**

<!-- GIF: Toggling "Show toolbar buttons" off in a view's Configure panel -->

You can disable TaskNotes controls on specific views. Open the view's Configure panel (the gear icon in the Bases toolbar) and toggle **Show toolbar buttons** off. This writes `showTaskNotesUI: false` to that view's configuration in the `.base` file.

**Right-click context menus:**

<!-- GIF: Right-clicking a row in a Bases view showing task vs non-task context menu options -->

On views with universal buttons, right-clicking a row or card shows a context menu:

- If the file is a task: the full task context menu (edit, complete, reschedule, etc.)
- If the file is not a task: "Convert to task" and "Open note" options

## Right-Click in the File Explorer

<!-- GIF: Right-clicking files and folders in the file explorer to open bulk tasking modal -->

You do not need a Bases view to use bulk tasking. Right-click any file or folder in Obsidian's file explorer:

- **Single file:** "Edit task" (if it is a task) or "Convert to task" (if it is not)
- **Multiple files:** Select several files, right-click, and choose **Bulk tasking (N files)** to open the bulk modal with those files
- **Folder:** Right-click a folder and choose **Bulk tasking (N files in folder)** to include all Markdown files inside it

The modal opens without a Bases view context, so the View Settings tab is not available. Generate, Convert, and Edit modes all work normally.

## Settings

These settings are in **Settings > Features > Bases views**:

| Setting | Default | Description |
|---------|---------|-------------|
| Bulk tasking button | On | Show the **Bulk tasking** button in Bases view toolbars |
| Universal view buttons | On | Show **New task** and **Bulk tasking** on all Bases views, not just TaskNotes view types |
| Default bulk mode | Generate | Which tab the bulk modal opens to by default (Generate or Convert) |

## Related

- [Task Management](task-management.md) for creating individual tasks
- [Custom Properties](custom-properties.md) for the PropertyPicker used in bulk operations
- [Per-View Property Mapping](per-base-mapping.md) for how views can use different property names
- [Views](../views.md) for the Bases views that bulk tasking operates on
