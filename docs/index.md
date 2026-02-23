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

People use TaskNotes in different ways depending on how they work. A few examples:

- **Track projects.** Create a view per project. See what is overdue, in progress, or blocked at a glance.
- **Turn notes into tasks.** Writing meeting notes or a project plan? Convert action items into tracked tasks without leaving the note.
- **Work as a team.** In a shared vault, attribute tasks to people, filter by assignee, and let each person control their own notifications.

These are starting points. TaskNotes is flexible enough to combine approaches or invent your own as your vault grows.

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

<!-- GIF: Quick tour cycling through 3-4 view types -->

![Kanban board showing tasks organized by status columns](assets/screenshot-kanban.png)

Each view is a `.base` file you can duplicate, customize, or create from scratch. Beyond filtering and display, views can trigger notifications, run bulk operations, and carry per-view property mappings. See [Views](views.md) for the full list and configuration options.

For the full data model, read [Core Concepts](core-concepts.md).

## Features

<!-- GIF: Task card showing project label, then clicking the subtask chevron to expand child tasks inline -->

![Task list sorted and grouped by status](assets/screenshot-tasks-list.png)

Tasks can link to projects and contain subtasks. Project names appear on task cards and in views, and subtasks are expandable directly from the card -- click the chevron to see child tasks without leaving the current view. These relationships are standard frontmatter links, so they work with Obsidian's graph and backlinks too.

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
