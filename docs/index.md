# TaskNotes Documentation

TaskNotes is a task and note management plugin for Obsidian that follows the "one note per task" principle. Task information is stored in YAML frontmatter, keeping your data in plain text files that work with any text editor.

## How It Works

The plugin treats each task as a separate note with structured metadata in the frontmatter. This approach aligns with Obsidian's "files over applications" philosophy - your tasks have structured data for organization while the note content remains completely flexible.

TaskNotes builds on Obsidian's native metadata cache, which means it works well with other plugins and benefits from Obsidian's existing performance optimizations. Since task data lives in YAML frontmatter, you can add custom fields and modify property names to match your vault's existing structure.

The plugin doesn't lock you into any specific task management methodology. Whether you prefer Getting Things Done, timeboxing, or project-based organization, TaskNotes provides the tools without forcing a particular workflow.

## Features

Each task supports standard properties like title, status, priority, due dates, contexts, and tags, plus time estimates, recurrence patterns, and reminders. Custom fields let you extend this structure however you need.

The built-in time tracking records work sessions directly in each task's frontmatter. For focused work, there's an integrated Pomodoro timer that automatically logs sessions to your tasks.

You can view your tasks through eight different interfaces: traditional task lists, calendar views (both mini and advanced), Kanban boards, agenda views, notes browsers, and Pomodoro tracking. Each view offers different ways to organize and interact with your data.

The plugin integrates directly into Obsidian's editor with inline task widgets that show task information right in your notes. Convert existing checkbox tasks instantly, or use natural language processing to create structured tasks from plain text.

Calendar integration works with external ICS feeds from Google Calendar, Outlook, and similar services. The advanced calendar view supports time-blocking and lets you drag tasks to reschedule them visually.

## Why One Note Per Task?

Individual task notes give you more than just basic task management. Each task can contain meeting notes, research, brainstorming, or any other content that makes sense alongside the task itself.

Since every task is a proper note, you get full access to Obsidian's linking system. Tasks can reference other notes, appear in your graph view, and show up in backlinks just like any other content in your vault.

This approach gives you structured metadata when you need it (for filtering and organizing) while keeping the actual note content completely flexible. You're not limited to predefined fields or rigid templates.

## Plain Text Advantages

Your task data lives in standard Markdown files with YAML frontmatter. This means you can edit tasks with any text editor, process them with scripts, or migrate them to other systems without vendor lock-in.

YAML frontmatter is widely supported and human-readable, so other Obsidian plugins can work with your task data. You can extend the structure by adding new fields whenever you need them.

Since everything is plain text, your tasks work naturally with version control systems like Git. The plugin leverages Obsidian's native metadata cache, so performance stays good even with thousands of tasks.

## Getting Started

To begin using TaskNotes effectively:

1. **Install and Enable**: Install the plugin from the Obsidian Community Plugins directory
2. **Create Your First Task**: Use the "Create Task" command or convert an existing checkbox
3. **Explore Views**: Try the different view types to find what works for your workflow
4. **Configure Settings**: Customize task properties, views, and integrations as needed

The plugin includes default settings that can be customized to support various task management approaches. Use the navigation menu to explore features, configuration options, and advanced capabilities.