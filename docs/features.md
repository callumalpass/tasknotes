# Features

TaskNotes covers the full spectrum of task management, from basic organization to advanced workflows with time tracking and calendar integration.

## Task Management

Tasks support configurable status and priority levels, along with due dates, scheduled dates, contexts, and tags. Time estimates and recurring patterns help with planning, while automatic creation and modification timestamps keep everything tracked.

Custom reminders use either relative timing ("3 days before due") or absolute dates. Tasks can auto-archive based on their completion status, keeping your active lists clean.

See [Task Management](features/task-management.md) for details.

## Filtering and Views

TaskNotes uses Obsidian's Bases core plugin for filtering, sorting, and grouping tasks. Views are defined through YAML-based `.base` files that specify query conditions, sort orders, and grouping criteria. Hierarchical subgrouping supports two-level organization.

For details on how Bases integration works, see [Core Concepts](core-concepts.md#bases-integration). For Bases syntax documentation, see the [official Obsidian Bases documentation](https://help.obsidian.md/Bases/Introduction+to+Bases).

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

TaskNotes integrates with external calendars (Google Calendar, Microsoft Outlook) via OAuth, ICS calendar subscriptions, and provides an HTTP API for automation.

See [Integrations](settings/integrations.md) for details.

## REST API

External applications can interact with TaskNotes through its REST API for automation, reporting, and integration with other tools.

See [HTTP API](HTTP_API.md) for details.
