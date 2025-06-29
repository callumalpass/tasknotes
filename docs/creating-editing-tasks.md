# Creating and Editing Tasks

TaskNotes provides multiple ways to create and edit tasks, accommodating different workflows and preferences. Tasks are stored as individual Markdown files with YAML frontmatter containing structured metadata.

## Task Creation Methods

### Manual Task Creation

**Task Creation Modal**: Use the "Create new task" command or buttons in various views to open a comprehensive task creation interface. The modal provides access to all available task properties and includes validation for required fields.

**Calendar Creation**: Click on dates or time slots in calendar views to create tasks with pre-populated scheduling information. The selected date automatically becomes the task's due date or scheduled date depending on the calendar view.

**Natural Language Creation**: Use the natural language parser to create tasks by typing descriptions in plain English. The parser extracts structured data from phrases like "Buy groceries tomorrow at 3pm @home #errands high priority".

### Automated Task Creation

**Inline Conversion**: Convert existing checkbox tasks in your notes to full TaskNotes using the instant conversion feature. Convert buttons appear next to checkbox tasks in edit mode.

**Template-Based Creation**: Tasks created through any method can use configured templates for both YAML frontmatter and note body content.

## Task Properties

### Required Fields

**Title**: The main task description. Required field with a maximum length of 200 characters. The title is used for filename generation and display across all views.

### Core Properties

**Status**: Current completion state of the task. Uses a customizable status system with the following defaults:
- None: No specific status assigned
- Open: Ready to begin work
- In Progress: Currently being worked on  
- Done: Completed task

**Priority**: Importance level of the task. Uses a weight-based priority system with defaults:
- None: No specific priority (weight 0)
- Low: Low importance (weight 1)
- Normal: Standard importance (weight 2)  
- High: High importance (weight 3)

### Scheduling Properties

**Due Date**: When the task must be completed. Supports multiple formats:
- Date only: `2025-01-15`
- Date with time: `2025-01-15T14:30:00`
- Date with timezone: `2025-01-15T14:30:00Z`

**Scheduled Date**: When you plan to work on the task. Uses the same format options as due dates. Scheduled dates are used primarily for calendar display and daily planning.

### Organization Properties

**Contexts**: Location or tool-based groupings using `@context` format (e.g., `@home`, `@computer`, `@phone`). Contexts help organize tasks by where or how they can be completed.

**Tags**: Standard Obsidian tags for broader categorization using `#tag` format. Tasks automatically include the main task tag configured in settings, plus any additional tags you specify.

### Planning Properties

**Time Estimate**: Expected time to complete the task, specified in minutes. The interface accepts various input formats and converts them to minutes for storage.

**Recurrence**: Recurring task patterns using the RFC 5545 RRule standard. Supports patterns like:
- Simple: "daily", "weekly", "monthly", "yearly"
- Interval-based: "every 2 weeks", "every 3 days"
- Day-specific: "every Monday", "first Friday of month"

### Tracking Properties

**Time Entries**: Recorded work sessions with start and stop times. Time tracking data is automatically managed through the time tracking interface and stored as an array of time entries.

**Archive Status**: Boolean flag managed through a special archive tag. Archived tasks can be hidden from most views while remaining accessible for reference.

## Creating Tasks

### Task Creation Workflow

1. **Open Creation Interface**: Use commands, view buttons, or calendar clicks to open the task creation modal
2. **Enter Task Information**: Fill in the title (required) and any additional properties
3. **Apply Defaults**: The system automatically applies configured default values for status, priority, contexts, and tags
4. **Process Templates**: If enabled, body templates are processed with variable substitution
5. **Generate Filename**: The system creates a unique filename based on your configured naming pattern
6. **Create File**: The task is saved as a Markdown file in your designated tasks folder

### Default Value Application

Tasks automatically receive default values from your settings:

**Status and Priority**: Your configured default status and priority levels
**Contexts and Tags**: Default context and tag strings (comma-separated in settings)
**Task Tag**: The main task tag is always included automatically
**Dates**: Optional default due dates and scheduled dates
**Time Estimate**: Default time estimate if configured
**Folder**: Tasks are created in your default tasks folder unless overridden

### Template System

TaskNotes supports templates for both YAML frontmatter and note body content:

**Template Variables**: Templates can include variables like:
- `{{title}}`: Task title
- `{{priority}}`: Priority level
- `{{status}}`: Current status
- `{{contexts}}`: Context list
- `{{tags}}`: Tag list
- `{{dueDate}}`: Due date
- `{{scheduledDate}}`: Scheduled date
- `{{parentNote}}`: Name of the note where task was created
- `{{date}}`: Current date
- `{{time}}`: Current time

**Frontmatter Merging**: Template frontmatter is merged with base task properties, with template values taking precedence for any specified fields.

## Editing Tasks

### Task Edit Modal

The task edit modal provides comprehensive editing capabilities:

**Pre-populated Fields**: All current task values are loaded automatically
**Change Detection**: Only modified fields are updated when saving
**Metadata Display**: Shows creation date, modification date, and file path
**Real-time Updates**: Status and priority indicators update as values change

### Inline Editing Options

Some task properties can be modified directly within views:

**Status Cycling**: Click status indicators to cycle through available statuses
**Priority Changes**: Click priority indicators to change priority levels
**Date Editing**: Click date displays to open date picker modals
**Quick Actions**: Use context menus for common editing operations

### Field Validation

The editing system includes validation for data integrity:

**Required Fields**: Title cannot be empty after trimming whitespace
**Format Validation**: Dates must be in supported formats
**Length Limits**: Title is limited to 200 characters
**Status/Priority Values**: Must match configured values in settings

## Advanced Features

### Field Mapping

TaskNotes allows customization of YAML property names through field mapping:

**Custom Property Names**: Map internal field names to your preferred YAML properties
**Backward Compatibility**: Supports existing vault structures with different property naming
**Bidirectional Mapping**: Converts between internal and custom field names automatically

### Natural Language Processing

The natural language parser can extract structured data from conversational input:

**Supported Syntax**:
- Dates: "tomorrow", "next Friday", "January 15th"
- Times: "3pm", "14:30", "9:00 AM"
- Priorities: "high priority", "urgent", "low"
- Statuses: "done", "in progress", "todo"
- Contexts: "@home", "@work", "@computer"
- Tags: "#project", "#urgent", "#work"
- Recurrence: "daily", "weekly", "every Monday"
- Time estimates: "30 minutes", "2 hours", "1h30m"

### Recurring Task Management

Recurring tasks use a sophisticated per-date completion system:

**Instance Tracking**: Each recurrence instance can be completed independently
**Completion Array**: Completed dates are stored in the `complete_instances` array
**Pattern Preservation**: Completing instances doesn't affect the recurrence pattern
**Calendar Display**: Each instance appears as a separate event in calendar views

### Archive Functionality

Tasks can be archived to reduce clutter while maintaining accessibility:

**Tag-Based System**: Uses a configurable archive tag to mark tasks as archived
**Toggle Function**: Easy archive/unarchive through context menus or edit modal
**View Integration**: Archived tasks can be shown or hidden in different views
**Search Inclusion**: Archived tasks can be included in search results when needed

## File Management

### Filename Generation

TaskNotes supports multiple filename generation patterns:

**Title-based**: Uses the task title with sanitization for filesystem compatibility
**Timestamp**: Uses creation timestamp for unique, chronological naming
**Zettelkasten**: Uses `YYMMDD` format plus base36 seconds since midnight (e.g., `25012715a`)
**Custom**: User-defined template with variable substitution

### Folder Organization

**Default Folder**: Configure where new tasks are created by default
**Folder Exclusions**: Specify folders to exclude from task scanning
**Auto-Creation**: Automatically create folder structure as needed for task organization