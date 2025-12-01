# Features

TaskNotes covers the full spectrum of task management, from basic organization to advanced workflows with time tracking and calendar integration.

## Task Management

Tasks support configurable status and priority levels, along with due dates, scheduled dates, contexts, and tags. Time estimates and recurring patterns help with planning, while automatic creation and modification timestamps keep everything tracked.

Custom reminders use either relative timing ("3 days before due") or absolute dates. Tasks can auto-archive based on their completion status, keeping your active lists clean.

See [Task Management](features/task-management.md) for details.

## Filtering and Views

TaskNotes v4 uses the Bases core plugin for filtering, sorting, and grouping tasks. Bases is an official Obsidian plugin built directly into the application. Views are defined through YAML-based `.base` files in your vault, which specify query conditions using AND/OR logic, sort orders, and grouping criteria by task properties such as tags, status, or custom fields.

Saved views are stored as `.base` files rather than in plugin settings. This allows multiple task perspectives that can be switched between. Hierarchical subgrouping supports two-level organization, where tasks are first grouped by one criterion (e.g., status) and then subdivided by another (e.g., priority).

The Bases core plugin must be enabled for TaskNotes main views to function.

For details on Bases syntax, filtering, and views, see the [official Obsidian Bases documentation](https://help.obsidian.md/Bases/Introduction+to+Bases).

## Inline Task Integration

Task management happens directly within notes through interactive widgets that overlay task links, showing information and allowing quick edits without leaving the editor. Convert existing checkbox tasks or create new tasks with the `create inline task` command.

Project notes display a Relationships widget showing all linked subtasks and dependencies in a collapsible interface. Natural language processing converts text into structured tasks, parsing dates, priorities, and other details across 12 languages. The NLP system includes customizable trigger phrases and a rich markdown editor for task creation.

See [Inline Task Integration](features/inline-tasks.md) for details.

## Time Management

Time tracking records work sessions for individual tasks. The Pomodoro timer provides timed work intervals. Analytics and statistics display productivity patterns over time. A Time Statistics view aggregates task time estimates over various periods.

See [Time Management](features/time-management.md) for details.

## Calendar Integration

TaskNotes supports OAuth-based calendar integration and ICS subscriptions. OAuth integration with Google Calendar and Microsoft Outlook provides bidirectional synchronization. Drag events to reschedule them, with changes syncing back to the calendar provider. OAuth calendars sync every 15 minutes and on local changes. ICS subscriptions from external calendar services provide read-only access to calendar events.

ICS export allows other systems to access task data with automatic updates. The calendar view supports multiple formats (month, week, day, year, plus configurable custom day ranges) with drag-and-drop task scheduling. Time-blocking creates work periods that link to specific tasks.

See [Calendar Integration](features/calendar-integration.md) for details.

## User Fields

Custom fields extend task structure with additional data. These fields work in filtering, sorting, and templates.

See [User Fields](features/user-fields.md) for details.

## Integrations

TaskNotes v4 requires the Bases core plugin to be enabled for main task views to function. Bases is an official Obsidian plugin built directly into the application, not a community plugin. This integration allows TaskNotes tasks to function as data sources within Bases databases.

See [Integrations](settings/integrations.md) for details.

## REST API

External applications can interact with TaskNotes through its REST API for automation, reporting, and integration with other tools.

See [HTTP API](../HTTP_API.md) for details.

## View Types

[Task List View](../views/task-list.md) handles filtering, sorting, and grouping. [Kanban View](../views/kanban-view.md) organizes tasks as cards across status columns.

[Calendar Views](../views/calendar-views.md) provide visual scheduling with time-blocking. The [Agenda View](../views/agenda-view.md) command opens the calendar's list mode for daily and weekly planning.

## Settings

[General](../settings/general.md) controls task identification, file storage, and click behavior. [Task Properties](../settings/task-properties.md) configures property keys, defaults, and NLP triggers. [Features](../settings/features.md) manages inline tasks, natural language processing, and the Pomodoro timer.

[Appearance & UI](../settings/appearance.md) controls visual elements. [Modal Fields](../settings/modal-fields.md) configures field visibility in task modals.

[Calendar Settings](../settings/calendar-settings.md) handles calendar appearance and behavior. [Integrations](../settings/integrations.md) manages OAuth calendars, ICS subscriptions, and the HTTP API. [Advanced Settings](../settings/advanced-settings.md) covers field mapping. [Misc Settings](../settings/misc-settings.md) contains additional options.
