# Task Management

TaskNotes provides a system for managing tasks, which is built on the principle of "one note per task." This approach allows you to create, edit, and organize your tasks with a set of properties, while maintaining the portability and extensibility of plain text files.

## Creating and Editing Tasks

You can create and edit tasks in a variety of ways. The primary method is through the **Task Creation Modal**, which can be accessed via the "Create new task" command or by clicking on dates or time slots in the calendar views. This modal provides an interface for setting all available task properties, including title, status, priority, and due dates.

TaskNotes also supports **Natural Language Creation**, which allows you to create tasks by typing descriptions in plain English. The built-in parser can extract structured data from phrases like "Buy groceries tomorrow at 3pm @home #errands high priority."

### Auto-Suggestions in Natural Language Input

The natural language input field includes auto-suggestion functionality that activates when typing specific trigger characters:

- **@** - Shows available contexts from existing tasks
- **#** - Shows available tags from existing tasks  
- **+** - Shows files from your vault as project suggestions

#### Project Suggestions

When typing `+` in the natural language input, you'll see up to 20 suggestions from your vault's markdown files. The suggestions display additional information to help identify files:

```
project-alpha [title: Alpha Project Development | aliases: alpha, proj-alpha]
meeting-notes [title: Weekly Team Meeting Notes]
simple-project
work-file [aliases: work, office-tasks]
```

Project suggestions search across:
- File names (basename without extension)
- Frontmatter titles (using your configured field mapping)
- Frontmatter aliases

Selecting a project suggestion inserts it as `+[[filename]]`, creating a wikilink to the file while maintaining the `+` project marker that the natural language parser recognizes.

Additionally, you can convert any line type in your notes to TaskNotes using the **Instant Conversion** feature. This works with checkboxes, bullet points, numbered lists, blockquotes, headers, and plain text lines.

## Task Properties

Each task in TaskNotes is a Markdown file with a YAML frontmatter block that stores its properties. The core properties include:

- **Title**: The main description of the task.
- **Status**: The current state of the task (e.g., "Open," "In Progress," "Done").
- **Priority**: The importance of the task (e.g., "Low," "Normal," "High").
- **Due Date**: The date by which the task must be completed.
- **Scheduled Date**: The date on which you plan to work on the task.
- **Contexts**: Location or tool-based groupings (e.g., "@home", "@work").
- **Projects**: Links to project notes in your vault that the task belongs to.
- **Tags**: Standard Obsidian tags for categorization.
- **Time Estimate**: The estimated time required to complete the task, in minutes.
- **Recurrence**: The pattern for repeating tasks, using the RRule standard.
- **Time Entries**: An array of recorded work sessions, with start and stop times.

You can also add your own custom fields to the YAML frontmatter, and use the **Field Mapping** feature to map them to TaskNotes' internal properties.

## Projects

TaskNotes supports organizing tasks into projects using note-based linking. Projects are represented as links to actual notes in your vault, allowing you to leverage Obsidian's linking and backlinking features for project management.

### Project Assignment

Tasks can be assigned to one or more projects through the task creation or editing interface. When creating or editing a task, click the "Add Project" button to open the project selection modal. This modal provides fuzzy search functionality to quickly find and select project notes from your vault.

### Project Links

Projects are stored as wikilinks in the task's frontmatter (e.g., `projects: ["[[Project A]]", "[[Project B]]"]`). These links are clickable in the task interface and will navigate directly to the project notes when clicked. Any note in your vault can serve as a project note simply by being linked from a task's projects field.

### Organization and Filtering

Tasks can be filtered and grouped by their associated projects in all task views. The FilterBar includes project-specific filters, and tasks can be grouped by project in the Task List and Kanban views. Tasks assigned to multiple projects will appear in each relevant project group, providing flexibility in project-based organization.

### Project Indicators

TaskCards display visual indicators when tasks are used as projects. These indicators help identify which tasks have other tasks linked to them as subtasks, making project hierarchy visible at a glance.

### Subtask Creation

Tasks can have subtasks created directly from their context menu. When viewing a task that serves as a project, you can select "Create subtask" to create a new task automatically linked to the current project.

### Template Integration

Projects support template variables for automated workflows. The `{{parentNote}}` variable inserts the parent note as a properly formatted markdown link. For project organization, it's recommended to use it as a YAML list item (e.g., `project:\n  - {{parentNote}}`) to align with the projects system behavior when creating tasks from project notes through instant conversion.

## File Management and Templates

TaskNotes provides a system for managing your task files. You can specify a **Default Tasks Folder** where all new tasks will be created, and you can choose from a variety of **Filename Generation** patterns, including title-based, timestamp-based, and Zettelkasten-style.

TaskNotes also supports **Templates** for both the YAML frontmatter and the body of your task notes. You can use templates to pre-fill common values, add boilerplate text, and create a consistent structure for your tasks. Templates can also include variables, such as `{{title}}`, `{{date}}`, and `{{parentNote}}` (which inserts the parent note as a properly formatted markdown link), which will be automatically replaced with the appropriate values when a new task is created.

## Recurring Tasks

TaskNotes supports recurring tasks using the RFC 5545 RRule standard, which allows for complex recurrence patterns. Recurring tasks can repeat on schedules like daily, weekly, monthly, or custom patterns such as "every third Tuesday" or "last Friday of each month."

### Setting Up Recurring Tasks

Recurring tasks require two key components:

1. **Scheduled Date**: This serves as the start date (anchor date) for the recurrence pattern. The scheduled date determines when the recurring series begins.
2. **Recurrence Pattern**: An RRule string that defines how the task repeats.

If no scheduled date is provided, the task's creation date is used as the fallback start date.

### Recurrence Patterns

TaskNotes uses the RRule standard format for defining recurrence patterns. Common examples include:

- `FREQ=DAILY` - Repeats every day
- `FREQ=WEEKLY;BYDAY=MO,WE,FR` - Repeats on Monday, Wednesday, and Friday
- `FREQ=MONTHLY;BYMONTHDAY=15` - Repeats on the 15th of each month
- `FREQ=MONTHLY;BYDAY=-1FR` - Repeats on the last Friday of each month

### Completion Tracking

Each instance of a recurring task can be completed independently. When you complete a recurring task on a specific date, that completion is recorded in the `complete_instances` array as a YYYY-MM-DD date string. This allows you to track which instances have been completed while keeping the recurrence pattern intact.

### Date Calculation

Recurring task instances are generated using UTC dates to prevent timezone-related display issues. The system calculates which dates should show the recurring task based on the scheduled date and recurrence pattern, ensuring consistent behavior across different time zones.

### Legacy Format Support

TaskNotes maintains backward compatibility with older recurrence formats. The system automatically converts legacy recurrence data to the modern RRule format when needed, ensuring your existing recurring tasks continue to work correctly.