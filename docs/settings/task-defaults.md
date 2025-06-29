# Task Defaults

Task defaults control how new tasks are created and what default values they receive. These settings help streamline task creation by pre-filling common values and configuring the basic task management workflow.

## Folder and File Management

### Default Tasks Folder

**Setting**: `tasksFolder`
**Default**: `TaskNotes/Tasks`

Specifies where new task files are created by default. The folder will be created automatically if it doesn't exist.

**Usage Notes**:
- Use forward slashes for folder paths
- Relative to your vault root
- Can be overridden per task using the default folder setting below

### Task Tag

**Setting**: `taskTag`  
**Default**: `task`

The Obsidian tag that identifies notes as TaskNotes. This tag is automatically added to all tasks.

**Important Behaviors**:
- Enter without the `#` symbol (the plugin adds this automatically)
- This tag is always included in task files
- Used by the plugin to identify which notes are tasks
- Changing this will not automatically update existing tasks

### Excluded Folders

**Setting**: `excludedFolders`
**Default**: Empty

Comma-separated list of folder paths to exclude from the Notes view. This setting helps performance by skipping folders that don't contain relevant notes.

**Format**: `folder1, folder2/subfolder, folder3`

## Filename Generation

### Filename Format

**Setting**: `taskFilenameFormat`
**Options**: `title`, `zettel`, `timestamp`, `custom`
**Default**: `zettel`

Controls how task filenames are generated:

**Title**: Uses the task title as the filename (sanitized for filesystem compatibility)
**Zettel**: Uses `YYMMDD` format plus base36 seconds since midnight (e.g., `25012715a`)
**Timestamp**: Full timestamp format `YYYY-MM-DD-HHMMSS`
**Custom**: Uses the custom filename template with variable substitution

### Custom Filename Template

**Setting**: `customFilenameTemplate`
**Default**: `{title}`

Template used when filename format is set to "custom". Supports variable substitution:

**Available Variables**:
- `{title}`: Task title
- `{date}`: Current date (YYYY-MM-DD)  
- `{time}`: Current time (HHMMSS)
- `{priority}`: Task priority
- `{status}`: Task status

**Example Templates**:
- `{date}-{title}`: Date prefix with title
- `Task-{date}-{time}`: Timestamp-based with prefix
- `{priority}-{title}`: Priority-based organization

## Default Task Properties

### Status and Priority

**Default Status**: `defaultTaskStatus`
**Default**: `open`

**Default Priority**: `defaultTaskPriority`  
**Default**: `normal`

These settings determine the initial status and priority assigned to new tasks. Values must match your configured statuses and priorities.

### Default Dates

**Default Due Date**: `defaultDueDate`
**Options**: `none`, `today`, `tomorrow`, `next-week`
**Default**: `none`

**Default Scheduled Date**: `defaultScheduledDate`
**Options**: `none`, `today`, `tomorrow`, `next-week`  
**Default**: `today`

Automatically assigns due dates and scheduled dates to new tasks based on the selected option.

### Organization Defaults

**Default Contexts**: `defaultContexts`
**Format**: Comma-separated string
**Example**: `@home, @computer, @phone`

**Default Tags**: `defaultTags`
**Format**: Comma-separated string  
**Example**: `#work, #project-alpha, #urgent`

These settings pre-populate the contexts and tags fields when creating new tasks.

### Time and Recurrence

**Default Time Estimate**: `defaultTimeEstimate`
**Default**: `0` (no estimate)
**Unit**: Minutes

**Default Recurrence**: `defaultRecurrence`
**Options**: `none`, `daily`, `weekly`, `monthly`, `yearly`
**Default**: `none`

Sets default time estimates and recurrence patterns for new tasks.



## Template System

### Body Template

**Use Body Template**: `useBodyTemplate`
**Default**: `false`

**Body Template Path**: `bodyTemplate`
**Default**: Empty

When enabled, applies a template file to the body content of new tasks.

### Template File Format

Template files can contain both YAML frontmatter and body content:

```markdown
---
customField: "default value"
projectTag: "project-name"
---

# Task Details

Use this section for additional context and notes.

## Related Links
- [[Project Overview]]
- [[Meeting Notes]]

## Progress Notes
- 
```

### Template Variables

Templates support variable substitution in both frontmatter and body content:

**Basic Variables**:
- `{{title}}`: Task title
- `{{details}}`: User-provided details from creation modal
- `{{date}}`: Current date (YYYY-MM-DD)
- `{{time}}`: Current time (HH:MM)

**Task Properties**:
- `{{priority}}`: Task priority level
- `{{status}}`: Task status
- `{{contexts}}`: Task contexts (comma-separated)
- `{{tags}}`: Task tags (comma-separated)
- `{{timeEstimate}}`: Time estimate in minutes
- `{{dueDate}}`: Due date if set
- `{{scheduledDate}}`: Scheduled date if set

**Context Variables**:
- `{{parentNote}}`: Link to the note where task was created (for instant conversion)

### Template Processing

**Frontmatter Merging**: Template frontmatter is merged with default task properties, with template values taking precedence.

**Variable Substitution**: All template variables are processed during task creation.

**Error Handling**: If the template file is missing or invalid, task creation continues with default content.

## Natural Language Processing

### Enable Natural Language Input

**Setting**: `enableNaturalLanguageInput`
**Default**: `true`

When enabled, shows a smart input field in the task creation modal that can parse natural language descriptions into structured task data.

### Default Date Type

**Setting**: `nlpDefaultToScheduled`
**Default**: `true`

When the natural language parser finds ambiguous dates (like "tomorrow" without "due" or "scheduled"), this setting determines whether they become due dates (false) or scheduled dates (true).

## Usage Examples

### Project-Based Setup

For project-based task management:

```
Tasks Folder: Projects/Current/Tasks
Default Contexts: @project
Default Tags: #current-project
Use Body Template: true
Body Template: Templates/Project-Task-Template.md
```

### GTD-Style Setup

For Getting Things Done methodology:

```
Tasks Folder: GTD/Tasks
Default Contexts: @anywhere
Default Status: open
Default Priority: normal
Filename Format: timestamp
```

### Simple Setup

For basic task management:

```
Tasks Folder: Tasks
Default Scheduled Date: today
Filename Format: title
Use Body Template: false
```

These defaults settings provide the foundation for your TaskNotes workflow and can be adjusted as your needs evolve.