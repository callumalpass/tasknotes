# Views

TaskNotes provides eight different view types, each designed for specific workflows and use cases. Views work with task data stored in your notes' YAML frontmatter, while some views also display regular notes from your vault.

## Overview of View Types

**Task List View**: A comprehensive task list with filtering, grouping, and sorting options. Displays all tasks across your vault with full task management capabilities.

**Notes View**: Shows regular vault notes organized by date. Displays notes created or modified on specific days. Useful for browsing your note-taking activity over time.

**Agenda View**: A chronological view combining both tasks and notes over a configurable time period. Shows items organized by date for daily and weekly planning.

**Kanban View**: Displays tasks as cards organized in columns. Columns can be grouped by status, priority, or context for visual workflow management.

**Mini Calendar View**: A compact month calendar with visual indicators for dates containing tasks, notes, or daily notes. Provides date navigation and overview.

**Advanced Calendar View**: A full-featured calendar using FullCalendar with multiple view modes (month, week, day). Supports task scheduling, external calendar integration, and time-blocking.

**Pomodoro View**: A timer interface for focused work sessions. Displays a circular progress timer with optional task association for time tracking.

**Pomodoro Stats View**: Statistics and history for pomodoro sessions. Shows completion rates, session history, and productivity metrics.

## Common View Features

All task-focused views share several common features:

**Filtering**: Filter tasks by status, priority, contexts, tags, date ranges, and other criteria. Filters can be combined to create specific task subsets.

**Search**: Full-text search across task titles and content. Search terms are highlighted in results.

**Sorting**: Sort tasks by title, due date, scheduled date, priority, status, creation date, or modification date in ascending or descending order.

**Grouping**: Group tasks by status, priority, contexts, tags, or dates to organize related items together.

**Quick Actions**: Perform common actions like marking tasks complete, changing status or priority, and editing properties directly from the view.

## View-Specific Features

### Task and Notes Views
- **Context Menus**: Right-click tasks for additional actions like opening in new tab or editing

### Calendar Views
- **Date Navigation**: Move between months, weeks, and days using navigation controls
- **Task Creation**: Create new tasks by clicking on dates or time slots
- **Drag and Drop**: Move tasks between dates by dragging (in Advanced Calendar View)
- **External Calendar Integration**: Display events from subscribed ICS calendars alongside tasks

### Kanban View
- **Column Customization**: Columns automatically match your configured task statuses
- **Card Details**: Task cards show title, due date, priority, and other key information
- **Status Progression**: Move tasks between columns to change their status

### Pomodoro Views
- **Timer Integration**: Start focused work sessions directly from tasks
- **Session Tracking**: Record time spent on specific tasks
- **Statistics**: View completion rates, total time spent, and productivity patterns

## View Persistence

TaskNotes remembers your view settings between sessions:

- Filter criteria and search terms
- Sort and grouping preferences  
- Selected date ranges and calendar positions
- View-specific settings like column widths

This allows you to set up views for specific workflows (like "Today's tasks" or "High priority items") and return to them quickly.

## Opening and Managing Views

Views can be opened through:

- **Command Palette**: Search for "TaskNotes" to see all available view commands
- **Ribbon Icons**: Add TaskNotes view icons to the ribbon for quick access
- **Hotkeys**: Assign keyboard shortcuts to frequently used views
- **Context Menus**: Some views can be opened from task links and other locations

Multiple instances of the same view type can be open simultaneously, each with independent settings. This allows you to monitor different aspects of your tasks at the same time.
