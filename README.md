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
- Individual Markdown files with YAML frontmatter
- Properties: title, status, priority, due date, scheduled date, contexts, tags, time estimates
- Recurring tasks with per-date completion tracking
- Time tracking with multiple sessions per task
- Archive function using tags
- Filtering and grouping options

### Calendar Integration
- Month view displaying tasks and notes
- Mini calendar for compact layouts
- ICS/iCal feed subscriptions
- Direct navigation to daily notes

### Time Management
- Time tracking with start/stop functionality
- Pomodoro timer with task integration
- Session history and statistics

### Editor Integration
- Interactive task previews for wikilinks
- One-click checkbox-to-task conversion
- Template support with parent note context

### Views
- **Calendar**: Month view with agenda
- **Task List**: Filtering and grouping options
- **Kanban**: Drag-and-drop task management
- **Agenda**: Daily task and note overview
- **Notes**: Date-based note browser
- **Pomodoro**: Timer with statistics

## Configuration

### Customization
- **Field Mapping**: Customize YAML property names to match existing workflows
- **Custom Statuses**: Define task statuses with colors and completion behavior
- **Custom Priorities**: Create priority levels with weight-based sorting
- **Templates**: Configure daily note templates with Obsidian variables

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