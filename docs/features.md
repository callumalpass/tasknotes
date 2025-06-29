# Features

TaskNotes provides a comprehensive set of features for task and note management within Obsidian. These features integrate with your existing vault structure while adding specialized functionality for organized productivity workflows.

## Overview

TaskNotes features can be grouped into several categories:

**Task Management**: Core functionality for creating, editing, and organizing tasks using individual note files with YAML frontmatter.

**Inline Integration**: Features that integrate tasks directly into your regular note-taking workflow, including widgets and conversion tools.

**Time Management**: Built-in time tracking and pomodoro timer functionality for measuring and improving productivity.

**Calendar Integration**: Support for external calendar systems and comprehensive scheduling capabilities.

**Natural Language Processing**: Intelligent parsing of natural language input to create structured tasks quickly.

**Workflow Customization**: Extensive customization options for statuses, priorities, field names, and visual appearance.

## Core Capabilities

### Task Data Storage
Tasks are stored as individual Markdown files with YAML frontmatter containing structured metadata. This approach ensures your data remains accessible and portable while enabling sophisticated task management features.

### Real-Time Synchronization
All views and features maintain real-time synchronization through an event-driven architecture. Changes made in one view immediately appear in all other open views without requiring manual refresh.

### Multi-View Support
Eight specialized view types provide different perspectives on the same underlying task data, allowing you to choose the most appropriate interface for your current workflow needs.

### Integration with Obsidian
TaskNotes leverages Obsidian's native features including metadata cache, file system events, and plugin architecture to provide optimal performance and compatibility with other plugins.

## Feature Categories

The following sections provide detailed documentation for each major feature category:

- **[Task Management](features/task-management.md)**: Creating, editing, and organizing tasks
- **[Inline Task Integration](features/inline-tasks.md)**: Editor widgets and conversion features  
- **[Time Tracking](features/time-tracking.md)**: Built-in time measurement and session management
- **[Natural Language Processing](features/natural-language.md)**: Smart parsing of task descriptions
- **[Calendar Integration](features/calendar-integration.md)**: External calendar support and scheduling

## Performance Considerations

TaskNotes is designed to handle large numbers of tasks efficiently:

**Minimal Caching**: Uses Obsidian's native metadata cache as the primary data source, supplemented by minimal indexing for performance-critical operations.

**Incremental Updates**: Only processes changed tasks rather than rescanning entire datasets.

**Lazy Loading**: Heavy operations are deferred until actually needed by the user interface.

**Memory Management**: Proper cleanup and lifecycle management prevent memory leaks during extended use.

## Customization Options

TaskNotes provides extensive customization capabilities:

**Field Mapping**: Customize YAML property names to match your existing vault structure.

**Status and Priority Systems**: Define custom statuses and priorities with colors and behaviors.

**Visual Styling**: All views respect Obsidian themes and support additional CSS customization.

**Workflow Configuration**: Adjust default values, templates, and automation behaviors to match your specific needs.