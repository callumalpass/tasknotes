---
hide:
  - toc
---

# TaskNotes Documentation

TaskNotes is a task and note management plugin for Obsidian that follows the "one note per task" principle. Each task is a Markdown file with structured metadata in YAML frontmatter.

![Task List view](assets/views-tasks-list.png)

## Requirements

TaskNotes requires **Obsidian 1.10.1** or later and depends on the **Bases** core plugin. Before you begin, open Obsidian Settings and confirm Bases is enabled under Core Plugins.

## Getting Started

### 1. Install and Enable

Install TaskNotes from Community Plugins in Obsidian settings, then enable it. If Bases is still disabled, enable it right away so TaskNotes views can open correctly.

### 2. Create Your First Task

Press <kbd>Ctrl+P</kbd> (or <kbd>Cmd+P</kbd> on macOS), run **TaskNotes: Create new task**, fill in the modal, and save. If you prefer inline workflows, start with a checkbox like `- [ ] Buy groceries` and convert it using the inline task command.

![Create task modal](assets/modal-task-create.png)

### 3. Open the Task List

Open your first view from the TaskNotes ribbon icon or by running **TaskNotes: Open tasks view** from the command palette. This opens the default Task List `.base` file inside `TaskNotes/Views`.

### 4. Explore

Use [Core Concepts](core-concepts.md) to understand the data model, [Features](features.md) for workflow capabilities, [Views](views.md) for interface behaviour, and [Settings](settings.md) to tune TaskNotes for your vault.

## Quick Links

<div class="card-grid">
  <a class="card" href="/features/task-management/">
    <span class="card__title">Task Management</span>
    <span class="card__desc">Status, priority, dates, reminders, and recurring tasks</span>
  </a>
  <a class="card" href="/features/inline-tasks/">
    <span class="card__title">Inline Tasks</span>
    <span class="card__desc">Widgets, natural language parsing, and checkbox conversion</span>
  </a>
  <a class="card" href="/features/calendar-integration/">
    <span class="card__title">Calendar Integration</span>
    <span class="card__desc">Google Calendar, Outlook, and ICS subscriptions</span>
  </a>
  <a class="card" href="/HTTP_API/">
    <span class="card__title">HTTP API</span>
    <span class="card__desc">REST API for automation and external integrations</span>
  </a>
  <a class="card" href="/migration-v3-to-v4/">
    <span class="card__title">Migration Guide</span>
    <span class="card__desc">Upgrading from TaskNotes v3 to v4</span>
  </a>
  <a class="card" href="/troubleshooting/">
    <span class="card__title">Troubleshooting</span>
    <span class="card__desc">Common issues and how to resolve them</span>
  </a>
</div>
