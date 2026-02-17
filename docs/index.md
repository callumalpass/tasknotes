# TaskNotes Documentation

TaskNotes is a task and note management plugin for Obsidian that follows the "one note per task" principle. Each task is a Markdown file with structured metadata in YAML frontmatter.

## Requirements

TaskNotes requires Obsidian 1.10.1 or later, and it depends on the Bases core plugin. Before you begin, open Obsidian settings and confirm that Bases is enabled under Core Plugins.

![Task List view](assets/views-tasks-list.png)

## Getting Started

### 1. Install and Enable

Install TaskNotes from Community Plugins in Obsidian settings, then enable it. If Bases is still disabled, enable it right away so TaskNotes views can open correctly.

### 2. Create Your First Task

The fastest way to create your first task is the command palette. Press `Ctrl/Cmd + P`, run `TaskNotes: Create new task`, then fill the modal and save. If you prefer inline workflows, you can also start with a checkbox like `- [ ] Buy groceries` and convert it using the inline task command.

![Create task modal](assets/modal-task-create.png)

### 3. Open the Task List

Open your first view from the TaskNotes ribbon icon or by running `TaskNotes: Open tasks view` from the command palette. This opens the default Task List `.base` file inside `TaskNotes/Views`.

### 4. Explore

From there, use [Core Concepts](core-concepts.md) to understand the data model, [Features](features.md) for workflow capabilities, [Views](views.md) for interface behavior, and [Settings](settings.md) to tune TaskNotes for your vault.

## Quick Links

| Topic | Description |
|-------|-------------|
| [Task Management](features/task-management.md) | Status, priority, dates, reminders, recurring tasks |
| [Inline Tasks](features/inline-tasks.md) | Widgets, natural language parsing, checkbox conversion |
| [Calendar Integration](features/calendar-integration.md) | Google Calendar, Outlook, ICS subscriptions |
| [HTTP API](HTTP_API.md) | REST API for automation and external tools |
| [Migration Guide](migration-v3-to-v4.md) | Upgrading from TaskNotes v3 |
| [Troubleshooting](troubleshooting.md) | Common issues and solutions |

Screenshots in this documentation are captured with the Playwright docs suite (`npm run e2e:docs`).
