# <img src="tasknotes-gradient.svg" width="32" height="32" style="vertical-align: middle;"> TaskNotes for Obsidian

Bases-based task management plugin where each task lives as a separate note with YAML frontmatter. Features calendar integration, Kanban boards, time tracking, and Pomodoro timer.

**UI Languages:** English · Deutsch · Español · Français · 日本語 · Русский · 中文

**NLP Support:** English · Deutsch · Español · Français · Italiano · 日本語 · Nederlands · Português · Русский · Svenska · Українська · 中文

<img src="https://github.com/callumalpass/tasknotes/blob/main/media/2025-12-07T15-43-26.png?raw=true" />

**[Documentation](https://callumalpass.github.io/tasknotes/)**

**Requirements:** Obsidian 1.10.1+ with the Bases core plugin enabled for main views (Task List, Kanban, Calendar, Agenda, MiniCalendar).

## Overview

Each task is a full Markdown note with structured metadata in YAML frontmatter. This means your tasks have all the benefits of regular notes - linking, tagging, graph view, and unlimited content - while still working as structured data for filtering and organization.

The plugin supports time tracking, recurring tasks, and calendar integration (ICS plus OAuth for Google and Microsoft). TaskNotes v4 moves its main views onto the Bases core plugin, so every view and filter is powered by Bases queries against your task files.

## Bases Integration (v4)

- All primary views (Task List, Kanban, Calendar, Agenda, MiniCalendar) are Bases files stored in `TaskNotes/Views/`
- Enable Bases from **Settings → Core Plugins**; view commands and ribbon icons open the corresponding `.base` files
- Customize sorting, grouping, and filters directly inside the `.base` YAML; Tasks act as a Bases data source using any frontmatter field or custom property

## Why YAML Frontmatter?

YAML is a standard data format that works with many tools, so you can easily extract and transform your task data into other formats. This keeps your data portable and aligns with Obsidian's file-over-app philosophy.

The frontmatter is extensible—add custom fields like "assigned-to" or "attachments" and use tools like Obsidian Bases to work with that data. This flexibility makes features like time-tracking natural, since there's an obvious place to store timing information.

Each task being a full note means you can write descriptions, jot down thoughts as you work, and connect tasks to other notes through Obsidian's linking and graph features. Bases integration provides custom views on your task data.

![Screenshot of TaskNotes plugin](https://github.com/callumalpass/tasknotes/blob/main/media/175266750_comp.gif)

## Core Features

### Task Management

- Individual Markdown files with YAML frontmatter
- Properties: title, status, priority, due date, scheduled date, contexts, projects, tags, time estimates, completion date
- Custom user fields with configurable types (text, number, boolean, date, list) and default values
- Project organization using note-based linking
- Recurring tasks with per-date completion tracking
- Flexible recurrence: choose between fixed schedule (scheduled-based) or flexible schedule (completion-based) recurrence
- Time tracking with multiple sessions per task
- Dependency management with blocked-by and blocking relationships
- Batch operations: multi-select tasks with Shift+click for bulk status, priority, and date changes
- Auto-archiving based on completion status

### Calendar Integration

- OAuth sync with Google Calendar and Microsoft Outlook
- ICS/iCal feed subscriptions with 15-minute auto-refresh
- Month, week, day, and year views with configurable event stacking
- Mini calendar view for compact layouts
- Direct navigation to daily notes

### Time Management

- Time tracking with start/stop functionality
- Pomodoro timer with task integration
- Session history and statistics

### Editor Integration

- Interactive task previews for wikilinks
- Inline task conversion for `- [ ] Checkbox tasks`
- Natural language parsing for dates, recurrence, contexts, and more
- Template support with parent note context

### Views

- **Calendar**: Month, week, day, and year views with agenda sidebar
- **Task List**: Inline search, filtering, and grouping options
- **Kanban**: Drag-and-drop with multi-select support
- **Agenda**: Daily task and note overview
- **Pomodoro**: Timer with statistics (standalone, not a Bases view)
- Formula properties for advanced Bases queries (due date calculations, time tracking stats, urgency scores)

![Task creation dialog](media/2025-07-15_21-11-10.png)

*Create tasks with natural language parsing for due dates, recurrence, and contexts*

![Pomodoro timer](media/2025-07-15_21-12-23.png)

*Built-in pomodoro timer with task integration and daily completion tracking*

![Kanban board view](media/2025-07-15_21-13-26.png)

*Kanban boards with drag-and-drop functionality and customizable columns*

![Project subtasks view](media/2025-07-15_21-14-06.png)

*Project management with subtasks and hierarchical organization*

## Configuration

### Customization

- **Field Mapping**: Customize YAML property names to match existing workflows
- **Custom Statuses**: Define task statuses with colors, icons, and completion behavior
- **Custom Priorities**: Create priority levels with weight-based sorting
- **User Fields**: Add custom properties with types, default values, and autosuggestions
- **Templates**: Configure task and daily note templates with variables

## YAML Structure

### Task Example

```yaml
title: "Complete documentation"
status: "in-progress"
due: "2024-01-20"
priority: "high"
contexts: ["work"]
projects: ["[[Website Redesign]]"]
timeEstimate: 120
timeEntries:
  - startTime: "2024-01-15T10:30:00Z"
    endTime: "2024-01-15T11:15:00Z"
```

### Recurring Task

```yaml
title: "Weekly meeting"
recurrence: "FREQ=WEEKLY;BYDAY=MO"
complete_instances: ["2024-01-08"]
```

## HTTP API & Webhooks

TaskNotes includes an optional HTTP API server for external integrations. This enables creating tasks from browsers, automation tools, mobile apps, and custom scripts.

### Browser Integration

The API enables browser integrations:
- **Bookmarklets** for one-click task creation from any webpage
- **Browser extensions**: [for example](https://github.com/callumalpass/tasknotes-browser-extension)
- **Automation** with Zapier, IFTTT, and similar services

### Webhooks

Configure webhooks to notify external services when tasks are created, updated, or completed. Supports custom payloads and authentication headers.

### Documentation

See [HTTP API Documentation](./docs/HTTP_API.md) and [Webhooks Documentation](./docs/webhooks.md) for complete endpoint reference and integration examples.

## Credits

This plugin uses [FullCalendar.io](https://fullcalendar.io/) for its calendar components.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
