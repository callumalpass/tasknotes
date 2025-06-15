# TaskNotes for Obsidian

![Downloads](https://img.shields.io/github/downloads/callumalpass/tasknotes/main.js)

TaskNotes is a comprehensive task and note management plugin for Obsidian with integrated calendar views and daily notes.

## Why TaskNotes?

With the introduction of Obsidian's new Bases core plugin, structured YAML frontmatter has become a more attractive way to manage data in Obsidian. TaskNotes uses YAML metadata extensively to store task properties, daily note information, and time tracking data. This means all your tasks and notes remain as plain Markdown files with structured frontmatter that can be queried and viewed in Bases tables.

TaskNotes focuses on time-based organization and task management, storing all data as YAML properties. While Bases provides database views of your notes, TaskNotes handles the day-to-day workflow of creating tasks, tracking time, managing recurring items, and organizing your daily activities. The structured data TaskNotes creates can then be analyzed and visualized using Bases or other data query tools.

![Screenshot of biblib Obsidian plugin](https://github.com/callumalpass/tasknotes/blob/main/media/2025-06-15_23-23-09.png)

## Features

### Task Management
- Tasks stored as individual Markdown files with YAML frontmatter
- Flexible filename formats: task title, zettelkasten ID, timestamp, or custom templates with live preview
- Task properties include: title, status, priority, due date, scheduled date, contexts, tags, time estimates, and time tracking data
- Instant Task Conversion: Convert checkbox tasks into dedicated TaskNotes with inline convert buttons
- Interactive Task Link Overlays: Preview and interact with tasks directly in the editor via wikilink overlays
- Support for recurring tasks (daily, weekly, monthly, yearly) with per-date completion tracking
- Enhanced recurring task UI with visual indicators and date-specific completion controls
- Built-in time tracking with multiple sessions per task
- Archive functionality using tags to hide completed tasks while preserving history
- Advanced filtering with search, status, context, priority, date range, and overdue task support (considers both due and scheduled dates)
- Flexible grouping options (status, priority, context, due date, scheduled date) with intelligent sorting
- Context menu interactions for quick task property changes

### Calendar Integration
- Advanced Calendar Views: Full-featured month view with comprehensive task and note display
- Mini Calendar Views: Compact calendar options for space-efficient layouts
- Unscheduled Tasks Modal: Dedicated interface for managing tasks without dates
- ICS Subscription Support: Subscribe to external ICS/iCal calendar feeds with configurable refresh intervals
- Clickable Date Navigation: Click calendar dates to create or navigate to daily notes directly
- Month view with agenda display showing tasks and notes
- Visual indicators for daily notes and due tasks
- Keyboard navigation and date selection synchronized across all views
- Color coding based on priority, note presence, or daily activities

### Time Management
- Integrated time tracking for tasks with start/stop functionality
- Time entries stored in YAML with timestamps and durations
- Time estimates vs actual time spent comparison
- Multiple tracking sessions per task with descriptions

### Pomodoro Timer
- Built-in Pomodoro timer with configurable work/break intervals
- Task selection using Obsidian's native fuzzy search modal
- Persistent task selection across sessions
- Enhanced visual timer with SVG progress circle and refined UI
- Automatic break scheduling with customizable patterns
- Persistent session history and detailed statistics tracking
- **Flexible Storage Options**: Store Pomodoro data in plugin files or integrate with Daily Notes
- Dedicated statistics view with completion metrics and trends
- Integration with task time tracking

### Editor Integration
- **Task Link Overlays**: Interactive task previews displayed on wikilinks in live preview mode
- **Instant Task Conversion**: One-click conversion of checkbox tasks to dedicated TaskNotes with inline buttons
- **Multi-line Task Conversion**: Support for converting multi-line selections with task details preserved
- **Configurable Conversion Defaults**: Apply default task properties during instant conversion
- **Enhanced Task Templates**: Template processing with parent note context ({{parentNote}} variable)
- **Smart Task Detection**: Automatic detection and enhancement of task-related content in the editor
- **Live Task Previews**: Hover and click interactions for task editing without leaving the current note

### Views and Layouts
- **Calendar View**: Advanced and mini calendar modes with agenda display and integrated controls
- **Mobile-Responsive Design**: Collapsible header filters for improved mobile calendar experience
- **Unscheduled Tasks Modal**: Dedicated modal for managing tasks without specific dates
- **Task List View**: Unified task management with advanced filtering and grouping
- **Kanban Board**: Visual task management with drag-and-drop functionality and dynamic grouping
- **Agenda View**: Combined daily overview of tasks and notes with timeline organization
- **Notes View**: Dedicated note browser with date-based filtering
- **Pomodoro Timer**: Focus timer with task integration and visual progress tracking
- **Pomodoro Statistics**: Detailed productivity metrics and session history
- **Popout Windows**: Desktop support for detaching any view into separate windows
- **Grid Layout**: Side-by-side views with calendar/list on one side, file preview on the other
- **Tabs Layout**: All views as switchable tabs with synchronized date selection

### Notes Organization
- Dedicated notes view for non-task files with improved card layout
- Date-based filtering to show notes created on specific days
- Enhanced note display with consistent styling across views
- Configurable folder exclusions
- Integration with calendar and agenda view for date-specific note viewing

### Customization System
- **Field Mapping**: Customize YAML property names to match your existing workflow
- **Custom Statuses**: Create unlimited task statuses with custom labels, colors, and completion behavior
- **Custom Priorities**: Define priority levels with weight-based sorting and custom colors
- **Calendar View Settings**: Comprehensive calendar configuration options with persistent view preferences
- **Inline Task Settings**: Configurable task link overlays and instant conversion behavior
- **Tabbed Settings**: Organized settings interface for easy configuration
- **Backward Compatibility**: Default settings match existing TaskNotes behavior

### Data Structure
All data is stored as YAML frontmatter in Markdown files, making it:
- Compatible with Obsidian's Bases plugin for database views
- Searchable and queryable using Dataview or similar tools
- Portable and future-proof as plain text files
- Version control friendly

## Quick Start

### First Steps

1. **Create your first task**: Use `Ctrl/Cmd + Shift + T` or the command palette
2. **Open a view**: Try the Calendar View to visualize your tasks
3. **Configure settings**: Customize TaskNotes to match your workflow

## Usage

### Getting Started

1. After installation, click the calendar icon in the ribbon to open the TaskNotes dashboard
2. Configure the plugin settings in Settings > TaskNotes
3. Create your first task or navigate to today's daily note

### Task Management and Interaction

TaskNotes provides intuitive controls to interact with your tasks across multiple views:

**Task List View:**
- Advanced filtering with search, status, context, priority, and date range options
- Flexible grouping by status, priority, context, or due date
- Click task titles to open detailed editing modal
- Context menu (right-click) for quick property changes
- Visual indicators for recurring tasks with date-specific completion status

**Kanban Board:**
- Visual task management with drag-and-drop functionality
- Dynamic grouping by status, priority, or context
- Search filtering across all columns
- Real-time updates when tasks are moved between columns

**Recurring Tasks:**
- Enhanced visual distinction with special styling and indicators
- Date-specific completion tracking using checkbox or context menu
- Smart context menus that prevent conflicting status changes
- Clear display of completion status for the current selected date

**All Views:**
- Change task status and priority using clickable badges (cycles through your custom options)
- Set or change due dates using the enhanced date picker modal
- All statuses and priorities are fully customizable with your own labels and colors

### Task Archiving

TaskNotes allows you to archive tasks to keep your task list clean while preserving task history:

- To archive a task, click the "Archive" button in the task controls
- Archived tasks are tagged with the "archive" tag in their YAML frontmatter
- Archived tasks are hidden from regular task views and only appear when "Archived" is selected from the status filter
- Archived tasks still appear in the calendar heatmap for historical reference
- To unarchive a task, select "Archived" from the status filter and click the "Unarchive" button on the task

### Commands

TaskNotes adds several commands to Obsidian's command palette:

- **Create New Task**: Opens a modal to create a new task
- **Go to Today's Note**: Navigates to or creates today's daily note
- **Start Pomodoro Timer**: Starts the Pomodoro timer (with task selection if none selected)
- **Open Pomodoro Statistics**: Opens the dedicated Pomodoro statistics view
- **Stop Active Timer**: Stops any currently running time tracking or Pomodoro session

### Folder Structure

TaskNotes uses the following folder structure by default (configurable in settings):

- `TaskNotes/Daily/`: Daily notes (YYYY-MM-DD.md)
- `TaskNotes/Tasks/`: Task files
- `TaskNotes/Notes/`: General notes

## Customization Guide

### Customizing Field Names

If you're migrating from another task management system or have existing notes with different property names, you can customize which YAML properties TaskNotes uses:

1. Go to Settings > TaskNotes > Field Mapping
2. Update any property names to match your existing structure
3. TaskNotes will read and write using your custom property names

**Example**: Change "priority" to "importance" if your existing notes use that property name.

### Creating Custom Statuses

TaskNotes allows you to define your own task statuses beyond the default Open/In Progress/Done:

1. Go to Settings > TaskNotes > Statuses
2. Click "Add status" to create new statuses
3. Configure the internal value, display label, color, and completion behavior
4. Reorder statuses to control the cycling sequence when clicking status badges

**Example custom statuses**: Waiting, Blocked, Review, Cancelled, Delegated

### Setting Up Custom Priorities

Create priority levels that match your workflow:

1. Go to Settings > TaskNotes > Priorities  
2. Click "Add priority" to create new priority levels
3. Set the weight (higher numbers = higher priority), label, and color
4. TaskNotes will sort tasks by priority weight automatically

**Example priorities**: Critical (weight: 5), High (3), Normal (2), Low (1), Someday (0)

## YAML Structure Examples

### Task File
```yaml
title: "Complete project documentation"
dateCreated: "2024-01-15T10:30:00"
dateModified: "2024-01-15T14:45:00"
status: "in-progress"
due: "2024-01-20"
scheduled: "2024-01-18"
tags: ["task", "documentation"]
priority: "high"
contexts: ["work", "writing"]
timeEstimate: 120
timeEntries:
  - startTime: "2024-01-15T10:30:00"
    endTime: "2024-01-15T11:15:00"
    description: "Initial outline"
```

### Daily Note
```yaml
date: "2024-01-15"
tags: ["daily"]
important: false
```

### Daily Note Template Example
```markdown
---
title: {{title}} Diary Entry
date: {{title}}
tags: [daily]
week: "[[{{date:gggg-[W]ww}}]]"
---

# {{title}}

## Goals for {{date:dddd}}
- 

## Notes
- 

## Reflections
- 
```

### Recurring Task
```yaml
title: "Weekly team meeting"
status: "open"
tags: ["task", "meetings"]
recurrence:
  frequency: "weekly"
  days_of_week: ["mon"]
complete_instances: ["2024-01-08", "2024-01-15"]
```

## Configuration

TaskNotes provides extensive customization options through a tabbed settings interface:

### Basic Setup
- Default tasks folder for new tasks (tasks are identified by tag, not folder)
- Task identification tag (default: "task")
- Excluded folders for notes view
- Default task status and priority for new tasks
- Task filename format: Task title, Zettelkasten ID, timestamp, or custom template
- Custom filename template with variables and live preview

### Field Mapping
Configure which frontmatter properties TaskNotes uses for each field. This allows you to customize property names to match your existing workflow:

- **Title**: Property name for task titles (default: "title")
- **Status**: Property name for task status (default: "status") 
- **Priority**: Property name for task priority (default: "priority")
- **Due date**: Property name for due dates (default: "due")
- **Scheduled date**: Property name for scheduled dates (default: "scheduled")
- **Contexts**: Property name for contexts/tags (default: "contexts")
- **Time tracking**: Properties for time estimates and tracking
- **Archive tag**: Property name for archived tasks (default: "archived")

**Warning**: TaskNotes reads and writes using these property names. Changing them after creating tasks may cause inconsistencies.

### Custom Statuses
Define custom task statuses with full control over labels, colors, and completion behavior:

- Create unlimited custom statuses
- Set display labels different from internal values
- Configure custom colors for visual distinction
- Mark statuses as "completed" to control task completion behavior
- Define the cycling order when clicking status badges
- Delete or modify existing statuses (minimum 2 required)

### Custom Priorities  
Define custom priority levels with weight-based sorting:

- Create unlimited priority levels
- Set display labels and internal values
- Configure custom colors for priority indicators
- Set numeric weights to control sorting order (higher weight = higher priority)
- Delete or modify existing priorities (minimum 1 required)

### Daily Notes
- Daily notes folder configuration
- Custom template file path with Obsidian variable support ({{title}}, {{date}}, {{time}}, etc.)
- Leave template empty to use built-in default

### Pomodoro Timer
- Work duration (default: 25 minutes)
- Short break duration (default: 5 minutes)
- Long break duration (default: 15 minutes)
- Long break interval (default: every 4 pomodoros)
- Auto-start breaks and work sessions
- Sound notifications and volume control
- Visual progress circle with enhanced timer display
- Session history tracking and persistent statistics
- **Storage Location**: Choose between plugin files or Daily Notes for Pomodoro data storage

### ICS Calendar Subscriptions
- Subscribe to external ICS/iCal calendar feeds
- Configurable refresh intervals and custom colors
- Automatic event caching and expiration handling
- Integration with calendar views to display external events
- Read-only event display with context menus for interaction

## Credits

This plugin uses [FullCalendar.io](https://fullcalendar.io/) for its calendar components.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

