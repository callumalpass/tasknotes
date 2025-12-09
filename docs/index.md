# TaskNotes Documentation

TaskNotes is a task and note management plugin for Obsidian that follows the "one note per task" principle. Each task is a Markdown file with structured metadata in YAML frontmatter.

## Requirements

- **Obsidian**: Version 1.10.1 or later
- **Bases Core Plugin**: Must be enabled (Settings → Core Plugins → Bases)

## Getting Started

### 1. Install and Enable

1. Open Obsidian Settings → Community Plugins
2. Browse and search for "TaskNotes"
3. Install and enable the plugin
4. Enable the Bases core plugin: Settings → Core Plugins → Bases

### 2. Create Your First Task

**Option A: Command Palette**

1. Press `Ctrl/Cmd + P` to open the command palette
2. Type "TaskNotes: Create new task"
3. Fill in the task details and click Create

**Option B: Convert a Checkbox**

1. In any note, type a checkbox: `- [ ] Buy groceries`
2. Position your cursor on the line
3. Click the convert button that appears, or use "TaskNotes: Create new inline task"

### 3. Open the Task List

1. Click the TaskNotes icon in the left ribbon, or
2. Use the command palette: "TaskNotes: Open tasks view"

### 4. Explore

- **[Core Concepts](core-concepts.md)**: How tasks work, YAML structure, Bases integration
- **[Features](features.md)**: Task properties, time tracking, calendar integration
- **[Views](views.md)**: Task List, Kanban, Calendar, Agenda, Pomodoro
- **[Settings](settings.md)**: Configuration options

## Quick Links

| Topic | Description |
|-------|-------------|
| [Task Management](features/task-management.md) | Status, priority, dates, reminders, recurring tasks |
| [Inline Tasks](features/inline-tasks.md) | Widgets, natural language parsing, checkbox conversion |
| [Calendar Integration](features/calendar-integration.md) | Google Calendar, Outlook, ICS subscriptions |
| [HTTP API](HTTP_API.md) | REST API for automation and external tools |
| [Migration Guide](migration-v3-to-v4.md) | Upgrading from TaskNotes v3 |
| [Troubleshooting](troubleshooting.md) | Common issues and solutions |
