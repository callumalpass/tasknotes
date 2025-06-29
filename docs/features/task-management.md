# Task Management

TaskNotes provides comprehensive task management capabilities built around the principle of storing each task as an individual Markdown note with YAML frontmatter for structured metadata.

## Task Creation

### Multiple Creation Methods

**Direct Creation**: Use the "Create new task" command or buttons in various views to open a task creation modal with all available fields.

**Calendar Creation**: Click on dates or time slots in calendar views to create tasks with pre-populated scheduling information.

**Inline Conversion**: Convert existing checkbox tasks in your notes to full TaskNotes using the instant conversion feature.

**Natural Language Creation**: Use the natural language parser to create tasks by typing descriptions like "Buy groceries tomorrow at 3pm @home #errands high priority".

### Task Properties

Each task can include the following properties stored in YAML frontmatter:

**Basic Information**:
- Title: The main task description
- Status: Current completion state (configurable)
- Priority: Importance level (configurable with weights)

**Scheduling**:
- Due Date: When the task must be completed
- Scheduled Date: When you plan to work on the task

**Organization**:
- Contexts: Location or tool-based groupings (e.g., @home, @computer)
- Tags: Standard Obsidian tags for broader categorization

**Planning**:
- Time Estimate: Expected time to complete (supports various formats)
- Recurrence: Recurring task patterns using RRule standard

**Tracking**:
- Time Entries: Recorded work sessions with start/stop times
- Creation Date: Automatically set when task is created
- Modification Date: Updated when task properties change

## Task Editing

### Modal-Based Editing

Task editing uses a comprehensive modal interface that provides access to all task properties. The edit modal can be opened by:

- Clicking task titles in most views
- Using context menu options
- Keyboard shortcuts when tasks are selected

### Inline Property Changes

Some task properties can be modified directly within views without opening the full edit modal:

- Status indicators can be clicked to cycle through available statuses
- Priority indicators can be clicked to change priority levels
- Due dates and scheduled dates can be edited through date picker widgets

### Bulk Operations

TaskNotes supports limited bulk operations for efficiency:

- Archive/unarchive multiple tasks
- Status changes for related tasks
- Date modifications for task groups

## File Management

### File Naming

Tasks are saved as individual Markdown files with configurable naming patterns:

**Title-based**: Uses the task title as the filename (with sanitization)
**Timestamp**: Uses creation timestamp for unique, chronological naming
**Zettelkasten**: Uses timestamp prefix with title suffix
**Custom**: User-defined template with variable substitution

### Folder Organization

**Default Folder**: Configure where new tasks are created by default
**Folder Exclusions**: Specify folders to exclude from task scanning
**Auto-Creation**: Automatically create folder structure as needed

### Template System

TaskNotes includes a template system for both YAML frontmatter and note body content:

**Variable Substitution**: Templates can include variables like `{{title}}`, `{{priority}}`, `{{dueDate}}`, `{{parentNote}}`
**Frontmatter Templates**: Define default YAML structure for new tasks
**Body Templates**: Include default content in the note body area

## Task Relationships

### Parent Note Context

The `{{parentNote}}` template variable captures context about where a task was created:

- Records the source note when tasks are created via inline conversion
- Provides backlink context for project-related tasks
- Enables project-based task organization

### Subtask Support

While TaskNotes doesn't enforce hierarchical task structures, you can create subtask relationships using:

- Obsidian's native linking system
- Context and tag-based grouping
- Project-based organization through templates

## Archive System

### Archive Functionality

TaskNotes provides an archive system for completed or cancelled tasks:

**Tag-Based**: Uses a configurable archive tag to mark tasks as archived
**Toggle Function**: Easy archive/unarchive capability
**Filter Integration**: Option to show or hide archived tasks in views

### Archive Benefits

- Keeps completed tasks accessible for reference
- Reduces clutter in active task views
- Maintains historical record of completed work
- Supports productivity analysis and reporting

## Recurring Tasks

### Recurrence Patterns

TaskNotes supports sophisticated recurring task patterns using the RRule standard:

**Simple Patterns**: Daily, weekly, monthly, yearly
**Interval-Based**: Every N days, weeks, or months
**Day-Specific**: Every Monday, first Friday of month, last day of month
**Complex Patterns**: Advanced scheduling using full RRule syntax

### Instance Management

Recurring tasks use a per-date completion system:

**Individual Completion**: Mark specific instances complete without affecting the pattern
**Instance Tracking**: System tracks completed dates in the `complete_instances` array
**Calendar Display**: Each instance appears as a separate event in calendar views

### Legacy Migration

The plugin includes migration support for older recurrence formats, automatically converting legacy `RecurrenceInfo` objects to the current RRule-based system.

## Performance and Scalability

### Efficient Data Handling

TaskNotes is designed to handle large numbers of tasks efficiently:

**Native Cache Integration**: Uses Obsidian's metadata cache for optimal performance
**Minimal Indexing**: Only creates indexes for performance-critical operations
**Event-Driven Updates**: Processes only changed files rather than full rescans

### Memory Management

Proper lifecycle management ensures stable performance:

**Component Cleanup**: All UI components properly dispose of resources
**Event Listener Management**: Prevents memory leaks from accumulating listeners
**Cache Optimization**: Balances memory usage with access speed