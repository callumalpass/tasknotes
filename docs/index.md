# TaskNotes Documentation

TaskNotes is a task and note management plugin for Obsidian. It is built on the principle of "one note per task," and it stores task information in YAML frontmatter.

## Approach and Design

TaskNotes stores all task information in YAML frontmatter within each note. This means that your task data is stored in plain text files that can be read and edited with any text editor.

The plugin follows Obsidian's "files over applications" philosophy. Each task has structured metadata in its frontmatter for filtering and organization, while the note content is free-form.

## Core Design Principles

The plugin is built around several key principles:

**Native Integration**: TaskNotes uses Obsidian's native metadata cache as its primary data source. This allows for compatibility with other plugins and takes advantage of Obsidian's existing performance optimizations.

**Extensible Data Model**: Task data is stored in YAML frontmatter, which allows you to add custom fields as needed. The plugin's field mapping system allows you to customize property names to match your existing vault structure.

**Multiple Views**: TaskNotes provides eight different view types, including task lists, calendar views, Kanban boards, and agenda views.

**Workflow Agnostic**: The plugin does not enforce a specific task management methodology. It provides a set of tools that can be used to support a variety of approaches, such as Getting Things Done (GTD), timeboxing, and project-based organization.

## Features

TaskNotes includes the following capabilities:

**Task Properties**: Each task can include a title, status, priority, due date, scheduled date, contexts, tags, time estimate, recurrence pattern, and reminders. You can also add custom fields.

**Time Tracking**: A time tracking feature allows you to record the amount of time that you spend on tasks. This data is stored in the task's frontmatter as time entries with start and stop times.

**View Types**: Eight different views are provided: Task List, Notes, Agenda, Kanban, Mini Calendar, Advanced Calendar, Pomodoro, and Pomodoro Stats.

**Editor Integration**: Inline task widgets display task information within your notes. An instant conversion feature transforms checkbox tasks into TaskNotes. A natural language parser can interpret phrases to create structured tasks.

**Calendar Integration**: The plugin can subscribe to external ICS calendars from Google Calendar, Outlook, and other calendar systems. Time-blocking features are also included.

**External Tool Compatibility**: The YAML frontmatter format is compatible with other Obsidian plugins and can be processed by external tools.

## The One-Note-Per-Task Approach

Using individual notes for each task has several implications:

**Rich Context**: Each task note can contain additional content beyond the basic task properties.

**Obsidian Integration**: Each task can be linked to other notes in the vault, which allows for the use of Obsidian's backlinking and graph visualization features.

**Structured and Flexible**: The frontmatter provides structured metadata for filtering and organization, while the note content is free-form.

**Portable Data**: Your task data is stored in standard Markdown files that can be read, edited, and processed by any text editor or automation tool.

## YAML Frontmatter Benefits

Using YAML frontmatter as the primary data storage has several implications:

**Standardized Format**: YAML is a human-readable data format with broad tool support.

**Extensibility**: You can add new fields to your task structure by including them in the frontmatter.

**Tool Compatibility**: The YAML format is compatible with other Obsidian plugins and can be processed by external tools.

**Version Control**: Since tasks are plain text files, they can be used with version control systems like Git.

**Performance**: By using Obsidian's native metadata cache, the plugin can maintain good performance with a large number of tasks.

## Getting Started

You can start with basic task creation and then explore more advanced features like calendar integration, time tracking, and custom workflows. The plugin includes default settings that can be customized.

## Documentation Navigation

### Core Documentation
- **[Features](features.md)** - Complete overview of TaskNotes capabilities
- **[Views](views.md)** - Guide to all available view types
- **[Settings](settings.md)** - Configuration options and customization
- **[Core Concepts](core-concepts.md)** - Understanding TaskNotes architecture
- **[Workflows](workflows.md)** - Example workflows and use cases
- **[Troubleshooting](troubleshooting.md)** - Common issues and solutions

### API Documentation
- **[HTTP API](HTTP_API.md)** - External integrations and automation
- **[NLP API](nlp-api.md)** - Natural language processing features
- **[Webhooks](webhooks.md)** - Event-driven integrations

### Advanced Topics
- **[Timezone Handling](TIMEZONE_HANDLING_GUIDE.md)** - Understanding timezone behavior
- **[Release Notes](releases.md)** - Version history and updates