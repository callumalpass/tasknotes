# TaskNotes for Obsidian

A task and note management plugin with calendar views and daily notes.

![Downloads](https://img.shields.io/github/downloads/callumalpass/tasknotes/main.js)
![Screenshot of biblib Obsidian plugin](https://github.com/callumalpass/tasknotes/blob/main/media/2025-06-15_23-32-16.png)

## Rationale

TaskNotes uses YAML frontmatter to store task data, providing several benefits. YAML is a standard format compatible with many tools, ensuring long-term data stability in line with Obsidian's file-over-app philosophy. The frontmatter approach makes it trivial to add custom fields like "assigned-to" or "attachments" that integrate seamlessly with other tools like Obsidian Bases. This extensibility has made it easy to add features like time-tracking, which would be difficult to implement cleanly in other task formats. The one-note-per-task approach enables you to add unstructured content in the note body for descriptions and progress notes. Each task becomes a full participant in your knowledge graph, leveraging native Obsidian features like backlinking and graph visualization. This creates a complete history and context for every task in one place.

## Core Features

### Task Management
- Individual Markdown files with YAML frontmatter
- Properties: title, status, priority, due date, scheduled date, contexts, tags, time estimates
- Recurring tasks with per-date completion tracking
- Time tracking with multiple sessions per task
- Archive functionality using tags
- Advanced filtering and grouping options

### Calendar Integration
- Month view with task and note display
- Mini calendar for compact layouts
- ICS/iCal subscription support
- Direct navigation to daily notes

### Time Management
- Built-in time tracking with start/stop functionality
- Pomodoro timer with task integration
- Session history and statistics

### Editor Integration
- Interactive task previews on wikilinks
- One-click checkbox-to-task conversion
- Template support with parent note context

### Views
- **Calendar**: Month view with agenda
- **Task List**: Filtering and grouping
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
recurrence:
  frequency: "weekly"
  days_of_week: ["mon"]
complete_instances: ["2024-01-08"]
```

## Credits

This plugin uses [FullCalendar.io](https://fullcalendar.io/) for its calendar components.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

