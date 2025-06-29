# Core Concepts

Understanding TaskNotes requires familiarity with several key concepts that shape how the plugin works and how tasks are structured.

## Tasks as Individual Notes

### File-Based Task Storage

Each task in TaskNotes exists as a separate Markdown file in your Obsidian vault. This fundamental design choice means that tasks are not stored in a database or proprietary format, but as standard text files that you own and control.

**Task File Structure**:
- YAML frontmatter containing structured task metadata
- Markdown body content for detailed descriptions, notes, and context
- Standard `.md` file extension for compatibility

**Benefits of Individual Files**:
- Each task can contain unlimited additional content beyond basic properties
- Tasks benefit from all Obsidian features like linking, tagging, and search
- Data remains accessible with any text editor or automation tool
- No vendor lock-in or proprietary data formats

### Task Identification

TaskNotes identifies which notes are tasks using a configurable tag (default: `#task`) that appears in each task file's frontmatter. This tag-based identification allows:

- Mixed content types within the same vault
- Easy conversion between regular notes and tasks
- Flexible organization without rigid folder structures
- Compatibility with existing vault organization schemes

## YAML Frontmatter Structure

### Metadata Storage

All task properties are stored in YAML frontmatter at the beginning of each task file. This structured metadata enables sophisticated filtering, sorting, and organization while keeping data in a standard, portable format.

**Example Task Frontmatter**:
```yaml
---
title: "Complete project documentation"
status: "in-progress"
priority: "high"
due: "2025-01-20"
scheduled: "2025-01-15"
contexts: ["computer", "work"]
tags: ["task", "project-alpha"]
timeEstimate: 120
dateCreated: "2025-01-10T09:30:00Z"
dateModified: "2025-01-15T14:20:00Z"
completedDate: null
recurrence: "FREQ=WEEKLY;BYDAY=MO"
timeEntries: []
complete_instances: []
pomodoros: 0
---
```

### Field Customization

The field mapping system allows you to customize YAML property names to match your existing vault structure or personal preferences. This enables integration with other plugins and tools that expect different property names.

**Default vs Custom Mapping**:
- Default: `due`, `scheduled`, `priority`
- Custom: `deadline`, `startDate`, `importance`

## Task Properties

### Core Properties

**Title**: The main task description, used for display and filename generation
**Status**: Current completion state, fully customizable with colors and behaviors
**Priority**: Importance level with configurable weights for sorting
**Due Date**: Deadline for task completion
**Scheduled Date**: When you plan to work on the task

### Organization Properties

**Contexts**: Location or tool-based groupings (e.g., `@home`, `@computer`)
**Tags**: Standard Obsidian tags for broader categorization
**Archive Status**: Special tag-based system for hiding completed tasks

### Advanced Properties

**Time Estimate**: Expected duration in minutes
**Time Entries**: Recorded work sessions with start/stop timestamps
**Recurrence**: Repeating task patterns using RRule standard
**Creation/Modification Dates**: Automatic timestamps for task lifecycle tracking

## Views and Perspectives

### Multiple View Types

TaskNotes provides eight different view types, each designed for specific workflows:

- **Task List**: Comprehensive task management with filtering and organization
- **Notes**: Date-based browsing of vault notes (not just tasks)
- **Agenda**: Combined timeline of tasks and notes over time periods
- **Kanban**: Visual workflow management with status-based columns
- **Mini Calendar**: Compact date navigation with task indicators
- **Advanced Calendar**: Full-featured calendar with external integration
- **Pomodoro**: Timer interface for focused work sessions
- **Pomodoro Stats**: Productivity analytics and session history

### Data Consistency

All views work with the same underlying task data stored in YAML frontmatter. Changes made in one view immediately appear in all other views without requiring manual refresh.

## Customization System

### Status and Priority Configuration

TaskNotes allows complete customization of status and priority systems:

**Status Configuration**:
- Define custom workflow states
- Assign colors and completion behaviors
- Control progression order for status cycling

**Priority Configuration**:
- Create priority levels with numeric weights
- Assign colors for visual distinction
- Support for custom priority hierarchies

### Field Mapping

The field mapping system enables:
- Custom YAML property names for all task fields
- Integration with existing vault structures
- Compatibility with other plugins and tools
- Preservation of existing task data when migrating

## Integration Features

### Editor Integration

**Task Link Widgets**: Replace wikilinks to tasks with interactive previews
**Instant Conversion**: Transform checkbox tasks into full TaskNotes
**Natural Language Processing**: Create tasks from conversational descriptions

### Calendar Integration

**External Calendars**: Subscribe to ICS feeds from Google Calendar, Outlook, and other services
**Timeblocking**: Create focused work periods linked to daily notes
**Multi-View Support**: Display tasks and external events in unified calendar interface

### Time Management

**Time Tracking**: Built-in start/stop time recording for tasks
**Pomodoro Integration**: Focused work sessions with automatic time tracking
**Session Analytics**: Productivity metrics and completion tracking

## Data Portability

### Standard Formats

TaskNotes uses only standard, well-established formats:
- **Markdown**: Universal text format for note content
- **YAML**: Widely-supported data serialization for metadata
- **RRule**: Standard recurrence format used by calendar applications
- **ISO 8601**: International standard for dates and timestamps

### Tool Compatibility

The standard format approach enables:
- Processing with external automation tools
- Integration with other Obsidian plugins
- Migration to different systems without data loss
- Backup and version control with standard tools

## Performance Considerations

### Efficient Architecture

TaskNotes achieves good performance through:
- **Native Cache Integration**: Uses Obsidian's metadata cache as primary data source
- **Minimal Indexing**: Creates only essential indexes for performance-critical operations
- **Event-Driven Updates**: Processes only changed files rather than full rescans
- **Lazy Loading**: Defers expensive operations until needed

### Scalability

The plugin handles large numbers of tasks through:
- **DOM Reconciliation**: Minimizes UI updates by calculating and applying only necessary changes, improving rendering performance for large lists.
- **Efficient Filtering**: Uses indexed data for fast search and filter operations
- **Incremental Updates**: Updates only modified tasks and affected views
- **Memory Management**: Proper cleanup prevents memory leaks during extended use

Understanding these core concepts provides the foundation for effectively using TaskNotes and adapting it to your specific workflow requirements.