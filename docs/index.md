# TaskNotes Documentation

<!--
Recording Script
SETUP:
  cd .obsidian/plugins/tasknotes
  node scripts/generate-test-data.mjs --clean   # or: bun run generate-test-data:clean
  Reload plugin in Obsidian (Ctrl+P → "Reload app without saving")

Show the vault with a task note open side-by-side with a Bases view
Quick create → view → complete loop
Cycle through 3-4 view types (task list, kanban, calendar, upcoming)
Show the "Quick tour" GIF at a brisk pace

CLEANUP: undo any task completions so data stays fresh, or re-run:
  node scripts/generate-test-data.mjs --clean   # or: bun run generate-test-data:clean
-->

<!-- MOCKUP: Hero banner showing a task note alongside a Bases view, conveying the "notes become tasks, views organize them" loop -->

TaskNotes turns Obsidian notes into a task management system. Each task is a Markdown file with structured metadata in YAML frontmatter, so your data stays portable, searchable, and entirely yours. [Obsidian Base](https://help.obsidian.md/bases) [views](https://help.obsidian.md/bases/views) act as workspaces for TaskNotes: filter, sort, group, and take action on your tasks without leaving Obsidian.

Your tasks live next to your notes, not in a separate app. That closeness is what makes TaskNotes powerful.

<!-- GIF: Quick loop showing create task > see it in a view > mark it complete -->



## Requirements

TaskNotes requires Obsidian 1.10.1 or later and depends on the [Bases](https://help.obsidian.md/bases) core plugin. Before you begin, open **Settings > Core Plugins** and confirm that **Bases** is enabled.

## Getting Started

### 1. Install and Enable

Install TaskNotes from **Community Plugins** in Obsidian settings, then enable it. If Bases is not enabled yet, turn it on now so TaskNotes views work correctly.

### 2. Pick a Workflow

TaskNotes supports four fundamental [modes of knowledge work](workflows.md), and most people blend them:

- **[Records & Registers](workflows.md#records--registers).** Maintain a body of knowledge — compliance controls, document libraries, asset inventories — and let views surface what needs attention.
- **[Capture & Execute](workflows.md#capture--execute).** Quickly capture tasks from meetings, notes, or ideas, then triage and execute from focused views.
- **[Orchestration](workflows.md#orchestration).** Coordinate projects with subtasks, dependencies, and team assignments across Kanban and Calendar views.
- **[Rhythm](workflows.md#rhythm).** Build habits and routines with recurring tasks, completion tracking, and review cycles.

These are starting points. TaskNotes is flexible enough to combine modes or invent your own workflows as your vault grows. See [Workflows](workflows.md) for detailed guides and examples.

### 3. Create Your First Task

Press `Ctrl/Cmd + P`, run **TaskNotes: Create new task**, fill in the modal, and save. TaskNotes creates a Markdown file with your task details in the frontmatter. You can also convert an existing checkbox like `- [ ] Buy groceries` into a full task using the inline task command.

### 4. See It in a View

Click the TaskNotes ribbon icon or run **TaskNotes: Open tasks view** from the command palette. This opens the default Task List, a `.base` file inside `TaskNotes/Views/`.

Views are the main way you interact with tasks. TaskNotes comes with several:

- **[Task List](views/task-list.md)** for a filterable, sortable table of everything
- **[Kanban](views/kanban-view.md)** for a board grouped by status, priority, or any property
- **[Calendar](views/calendar-views.md)** for month, week, and day scheduling
- **[Upcoming](views/upcoming-view.md)** for a time-grouped overview (Overdue, Today, This Week, and beyond)
- **[Agenda](views/agenda-view.md)** for short-horizon daily planning

<!-- GIF: Quick tour cycling through 3-4 view types (use TaskNotes/Demos/ bases from test fixtures) — reuse this GIF on views.md -->

Each view is a `.base` file you can duplicate, customize, or create from scratch. Beyond filtering and display, views can trigger notifications, run bulk operations, and carry per-view property mappings. See [Views](views.md) for the full list and configuration options.

For the full data model, read [Core Concepts](core-concepts.md).

## Features

TaskNotes covers the full task lifecycle -- create tasks from a modal or natural language, organize them in views, set reminders, track time, and collaborate in shared vaults. Here are the highlights.

### Viewing and Filtering

Add filters, change grouping, write formulas. Views are stored in [YAML](https://help.obsidian.md/properties#Property+format), a standard format readable by any text editor, so you can open and tweak them directly.

| Topic | Description |
|-------|-------------|
| [Views](views.md) | Task List, Kanban, Calendar, Agenda, and more |
| [Custom Fields](features/user-fields.md) | Add any frontmatter field to your tasks and use it in filters, views, and templates |

### Creating and Managing Tasks

Schedule tasks, set reminders, convert checkboxes into full task notes, or create tasks in batch from any view. Right-click files or folders in the file explorer to bulk-task them. Views double as editable tables for managing many tasks at once.

| Topic                                          | Description                                                          |
| ---------------------------------------------- | -------------------------------------------------------------------- |
| [Task Management](features/task-management.md) | Status, priority, dates, reminders, recurring tasks                  |
| [Inline Tasks](features/inline-tasks.md)       | Widgets, natural language parsing, checkbox conversion               |
| [Bulk Tasking](features/bulk-tasking.md)        | Create, convert, or edit tasks in batch from any view                |

### Dates, Reminders, and Notifications

Reminders alert you before or after a task is due. You can also enable notifications on any view to get alerted when items arrive in the view. Sync dates with Google Calendar or Outlook.

| Topic | Description |
|-------|-------------|
| [Reminders](features/reminders.md) | Per-task date reminders with configurable lead times |
| [Calendar Integration](features/calendar-integration.md) | Google Calendar, Outlook, ICS subscriptions |
| [Recurring Tasks](features/recurring-tasks.md) | Repeating task patterns and recurrence rules |

### Collaboration

In a shared vault, TaskNotes automatically detects who is on each device and maps them to a person note. Tasks are attributed to people or groups, notifications  filter to show only your assignments, and each person can override settings on their own device without affecting anyone else.

| Topic                                          | Description                                                      |
| ---------------------------------------------- | ---------------------------------------------------------------- |
| [Team & Attribution](features/shared-vault.md) | Device identity, person notes, team attribution in shared vaults |

### Automation and API

| Topic | Description |
|-------|-------------|
| [HTTP API](HTTP_API.md) | REST API for external tools and automation |
| [Webhooks](webhooks.md) | Event-driven integrations with external services |
| [Obsidian CLI](https://help.obsidian.md/cli) | Query views, reload plugins, and run commands from the terminal |

### Settings and Configuration

Use your own property names instead of the defaults, set values so new tasks start the way you want, choose which fields appear in task modals, and tune nearly every behavior to match your workflow.

| Topic | Description |
|-------|-------------|
| [Settings](settings.md) | Configure TaskNotes for your vault |
| [Migration Guide](migration-v3-to-v4.md) | Upgrading from TaskNotes v3 |
| [Troubleshooting](troubleshooting.md) | Common issues and solutions |

## Why TaskNotes?

TaskNotes takes Obsidian and filesystem primitives and moves task management as close as possible to the actual work, without locking you into a system. Every task is a Markdown file. Every view is a configurable query. Every property is standard YAML frontmatter. Nothing is locked away in a database or proprietary format.

This approach scales. One person tracking personal projects and a team coordinating complex projects can use the same system. Add more views, more properties, more people. Your tasks grow with your vault, not against it.

## Roadmap and Feedback

TaskNotes is actively developed. See what is planned and what shipped recently:

- **[Roadmap and planned features](https://github.com/callumalpass/tasknotes/milestones)**
- **[Report a bug or request a feature](https://github.com/callumalpass/tasknotes/issues)**
- **[Release notes](https://github.com/callumalpass/tasknotes/releases)**

## For Developers

TaskNotes exposes an [HTTP API](HTTP_API.md) and [webhook system](webhooks.md) for automation and external integrations. To contribute or explore the codebase, see the [contributing guide](contributing.md) and the source on GitHub: [callumalpass/tasknotes](https://github.com/callumalpass/tasknotes).
