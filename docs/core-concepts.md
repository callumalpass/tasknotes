# Core Concepts

TaskNotes follows the "one note per task" principle, where each task lives as a separate Markdown note with structured metadata in YAML frontmatter.

## The Note-Per-Task Approach

Individual Markdown notes replace centralized databases or proprietary formats. Each task file can be read, edited, and backed up with any text editor or automation tool.

### Task Structure

A TaskNotes task is a standard Markdown file with YAML frontmatter:

```markdown
---
tags:
  - task
title: Review quarterly report
status: in-progress
priority: high
due: 2025-01-15
scheduled: 2025-01-14
contexts:
  - "@office"
projects:
  - "[[Q1 Planning]]"
---

## Notes

Key points to review:
- Revenue projections
- Budget allocations

## Meeting Notes

Discussion with finance team on 2025-01-10...
```

The frontmatter contains structured, queryable properties. The note body holds freeform content—research findings, meeting notes, checklists, or links to related documents.

### Obsidian Integration

Since tasks are proper notes, they work with Obsidian's core features:

- **Backlinks**: See which notes reference a task
- **Graph View**: Visualize task relationships and project connections
- **Tags**: Use Obsidian's tag system for additional categorization
- **Search**: Find tasks using Obsidian's search
- **Links**: Reference tasks from daily notes, meeting notes, or project documents

This approach creates many small files. TaskNotes stores tasks in a configurable folder (default: `TaskNotes/Tasks/`) to keep them organized.

## YAML Frontmatter

Task properties are stored in YAML frontmatter, a standard format with broad tool support.

### Property Types

TaskNotes uses several property types:

| Type | Example | Description |
|------|---------|-------------|
| Text | `title: Buy groceries` | Single text value |
| List | `tags: [work, urgent]` | Multiple values |
| Date | `due: 2025-01-15` | ISO 8601 date format |
| DateTime | `scheduled: 2025-01-15T09:00` | Date with time |
| Link | `projects: ["[[Project A]]"]` | Obsidian wikilinks |
| Number | `timeEstimate: 60` | Numeric values (minutes) |

### Field Mapping

Property keys are configurable. If your vault uses `deadline` instead of `due`, you can map TaskNotes to use your existing field names without modifying your files.

### Custom Fields

Add any frontmatter property to your tasks. User-defined fields work in filtering, sorting, and templates. Define custom fields in Settings → Task Properties to include them in task modals and views.

## Bases Integration

TaskNotes v4 uses Obsidian's Bases core plugin for its main views. Bases provides:

- **Filtering**: Query tasks using AND/OR conditions
- **Sorting**: Order tasks by any property
- **Grouping**: Organize tasks by status, priority, project, or custom fields
- **Views**: Task List, Kanban, Calendar, and Agenda are all Bases views

Views are stored as `.base` files in `TaskNotes/Views/`. These files contain YAML configuration that defines the view's query and display settings. You can duplicate, modify, or create new views by editing these files.

### Enabling Bases

Bases is a core plugin included with Obsidian 1.10.1+:

1. Open Settings → Core Plugins
2. Enable "Bases"
3. TaskNotes views will now function

## Methodology-Agnostic Design

TaskNotes provides tools without enforcing a specific productivity methodology. The same features support different approaches:

### Getting Things Done (GTD)

- **Contexts** (`@home`, `@office`, `@phone`) for location/tool-based grouping
- **Projects** for multi-step outcomes
- **Status workflows** for next actions, waiting, and someday/maybe
- **Calendar integration** for time-specific commitments

### Time-Based Planning

- **Calendar views** for scheduling and time-blocking
- **Scheduled dates** for when to work on tasks
- **Time tracking** for logging work sessions
- **Pomodoro timer** for focused work intervals

### Project-Centric Workflows

- **Project links** connecting tasks to project notes
- **Dependencies** for task sequencing
- **Subtasks** created from project context menus
- **Filtering by project** in all views

### Kanban / Agile

- **Kanban view** with customizable columns
- **Swimlanes** for two-dimensional organization
- **Drag-and-drop** status changes
- **Custom status values** for your workflow stages
