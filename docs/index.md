# TaskNotes Documentation

TaskNotes is a task and note management plugin for Obsidian built on the principle of "one note per task." It stores task information directly in your notes using YAML frontmatter, treating each task as a complete Markdown note that can contain detailed descriptions, links, and any other content you need.

## Approach and Design

TaskNotes takes a different approach to task management compared to other plugins. Instead of maintaining separate databases or proprietary formats, it stores all task information directly in your notes using YAML frontmatter. This means your task data remains in plain text files that you can read and edit with any text editor.

The plugin follows Obsidian's "files over applications" philosophy by treating each task as a complete Markdown note. Every task can contain structured metadata in the frontmatter for filtering and organization, while the note content remains completely free-form for detailed descriptions, research, or any other relevant information.

## Core Design Principles

The plugin is built around several key principles:

**Native Integration**: TaskNotes uses Obsidian's native metadata cache as its primary data source. This ensures compatibility with other plugins and takes advantage of Obsidian's existing performance optimizations.

**Extensible Data Model**: Task data is stored in YAML frontmatter, which means you can add custom fields as needed. The plugin's field mapping system allows you to customize property names to match your existing vault structure.

**Multiple Views**: Different workflows require different ways of viewing the same data. TaskNotes provides eight different view types - task lists, calendar views, Kanban boards, agenda views, and others - while maintaining a single source of truth for your task data.

**Workflow Agnostic**: The plugin doesn't enforce a specific task management methodology. It provides flexible tools that can support various approaches like Getting Things Done (GTD), timeboxing, project-based organization, or hybrid approaches.

## Features

TaskNotes includes the following capabilities:

**Task Properties**: Each task can include title, status, priority, due dates, scheduled dates, contexts, tags, time estimates, and recurrence patterns. You can also add custom fields as needed.

**Time Tracking**: Built-in time tracking allows you to record how long tasks actually take. This data is stored directly in the task's frontmatter as time entries with start and stop times.

**View Types**: Eight different views provide different perspectives on your tasks: Task List, Notes, Agenda, Kanban, Mini Calendar, Advanced Calendar, Pomodoro, and Pomodoro Stats views.

**Editor Integration**: Inline task widgets display task information directly within your notes. An instant conversion feature transforms simple checkbox tasks into full TaskNotes. A natural language parser can interpret phrases like "Buy groceries tomorrow at 3pm @home #errands high priority" to create structured tasks.

**Calendar Integration**: The plugin can subscribe to external ICS calendars from Google Calendar, Outlook, or other calendar systems, displaying external events alongside your tasks. Time-blocking features help you schedule focused work sessions.

**External Tool Compatibility**: The YAML frontmatter format works with other Obsidian plugins for database-style operations and can be processed by external tools for reporting or automation.

## The One-Note-Per-Task Approach

Using individual notes for each task provides several advantages:

**Rich Context**: Each task note can contain unlimited additional content beyond the basic task properties. You can add research findings, meeting notes, links to related documents, embedded images, or any other relevant information directly in the task note.

**Obsidian Integration**: Each task benefits from Obsidian's features like backlinking, graph visualization, full-text search, and compatibility with other plugins. You can link tasks to people, projects, or concepts in your vault.

**Structured and Flexible**: The frontmatter provides structured metadata for filtering and organization, while the note content remains free-form. This allows for both precise data management and detailed context within the same file.

**Portable Data**: Your task data is stored in standard Markdown files that can be read, edited, and processed by any text editor or automation tool. This eliminates vendor lock-in concerns.

## YAML Frontmatter Benefits

Using YAML frontmatter as the primary data storage provides several advantages:

**Standardized Format**: YAML is an established, human-readable data format with broad tool support. Task data can be easily parsed, transformed, and integrated with external systems using standard programming languages and tools.

**Extensibility**: Adding new fields to your task structure requires only including them in the frontmatter. You can add project codes, client information, or any other custom metadata without waiting for plugin updates.

**Tool Compatibility**: The YAML format works with Obsidian's Bases plugin for database-style operations like bulk updates and complex filtering. It also enables integration with external tools for reporting and automation.

**Version Control**: Since tasks are plain text files, they work with version control systems like Git. You can track changes to your task data over time and collaborate with others.

**Performance**: By using Obsidian's native metadata cache, the plugin maintains good performance even with large numbers of tasks while providing real-time updates across all views.

## Getting Started

You can start with basic task creation and gradually explore more advanced features like calendar integration, time tracking, and custom workflows. The plugin includes default settings that work for most users, but most aspects can be customized to match your specific requirements.

This documentation covers every aspect of TaskNotes, from basic setup and task creation to advanced features like natural language processing and external calendar integration.
