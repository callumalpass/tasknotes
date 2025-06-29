# TaskNotes for Obsidian

A task and note management plugin with calendar views and daily notes.

![Downloads](https://img.shields.io/github/downloads/callumalpass/tasknotes/main.js)
![Screenshot of biblib Obsidian plugin](https://github.com/callumalpass/tasknotes/blob/main/media/2025-06-15_23-32-16.png)

## Documentation

**[Documentation](https://callumalpass.github.io/tasknotes/)**

## Rationale

TaskNotes uses YAML frontmatter to store task data. YAML is a standard format that is compatible with many tools, which aligns with Obsidian's file-over-app philosophy. The frontmatter approach allows for the addition of custom fields, such as "assigned-to" or "attachments," which can be integrated with other tools like Obsidian Bases. This extensibility has been used to add features like time-tracking. The one-note-per-task approach allows for the inclusion of unstructured content in the note body for descriptions and progress notes. Each task can be linked to other notes in the vault, which allows for the use of Obsidian's backlinking and graph visualization features.

## Core Features

### Task Management
- Tasks are stored as individual Markdown files with YAML frontmatter.
- Properties include: title, status, priority, due date, scheduled date, contexts, tags, and time estimates.
- Recurring tasks are supported, with per-date completion tracking.
- Time tracking is available, with multiple sessions per task.
- An archive function is provided, which uses tags.
- Filtering and grouping options are available.

### Calendar Integration
- A month view is provided, which displays tasks and notes.
- A mini calendar is available for compact layouts.
- Subscriptions to ICS/iCal feeds are supported.
- Direct navigation to daily notes is available.

### Time Management
- A time tracking feature is included, with start/stop functionality.
- A Pomodoro timer is available, with task integration.
- Session history and statistics are provided.

### Editor Integration
- Interactive task previews are available for wikilinks.
- A one-click checkbox-to-task conversion feature is included.
- Template support is provided, with parent note context.

### Views
- **Calendar**: A month view with an agenda.
- **Task List**: A view with filtering and grouping options.
- **Kanban**: A view with drag-and-drop task management.
- **Agenda**: A daily task and note overview.
- **Notes**: A date-based note browser.
- **Pomodoro**: A timer with statistics.

## Configuration

### Customization
- **Field Mapping**: YAML property names can be customized to match existing workflows.
- **Custom Statuses**: Task statuses can be defined, with colors and completion behavior.
- **Custom Priorities**: Priority levels can be created, with weight-based sorting.
- **Templates**: Daily note templates can be configured with Obsidian variables.

## YAML Structure

### Task Example
```yaml
title: "Complete documentation"
status: "in-progress"
due: "2024-01-20"
priority: "high"
contexts: ["work"]
timeEstimate: 120
timeEntries:
  - startTime: "2024-01-15T10:30:00"
    endTime: "2024-01-15T11:15:00"
```

### Recurring Task
```yaml
title: "Weekly meeting"
recurrence: "FREQ=WEEKLY;BYDAY=MO"
complete_instances: ["2024-01-08"]
```

## Credits

This plugin uses [FullCalendar.io](https://fullcalendar.io/) for its calendar components.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.