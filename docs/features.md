# Features

<!--
Recording Script
SETUP:
  cd .obsidian/plugins/tasknotes
  node scripts/generate-test-data.mjs --clean   # or: bun run generate-test-data:clean
  Reload plugin in Obsidian

Cycle through different view types in the same vault (task list → kanban → calendar → upcoming)
Show the features overview page as a visual index
-->



TaskNotes includes task organization, time tracking, and calendar integration features.

## Task Management

TaskNotes gives each task a structured set of properties, including status, priority, due and scheduled dates, tags, contexts, and optional estimates. Because these values live in frontmatter, they stay readable and portable while still powering advanced filtering and grouping in Bases.

Reminders can be relative (for example, "3 days before due") or absolute, and completed tasks can be archived automatically to keep active work surfaces focused.

See [Task Management](features/task-management.md) for details.
For recurrence behavior, see [Recurring Tasks](features/recurring-tasks.md).
For reminder setup and data format, see [Task Reminders](features/reminders.md).

### Bulk Tasking

Create, convert, or edit tasks in batch from any Bases view. The idea is to add tasking as a dimension to things you already track -- if you have a Bases view of meeting notes, project documents, or compliance checklists, bulk tasking lets you generate linked tasks from those items without restructuring anything. You can also convert existing notes into tasks in place or modify properties across many tasks at once. The bulk tasking modal also works from the file explorer.

See [Bulk Tasking](features/bulk-tasking.md) for details.

### Custom Properties

Register your own frontmatter fields so they become first-class parts of the task workflow. Custom properties appear in every task creation and edit modal, support autocomplete with file suggestion filtering (e.g., limit an "Assignee" field to notes tagged `#person`), can have default values that pre-fill on new tasks, are recognized by NLP task creation, and round-trip through Bases views for filtering, sorting, and grouping. Add fields like `client`, `effort`, `billing_code`, or `review_stage` and they work everywhere built-in fields do.

See [Custom Properties](features/custom-properties.md) for details.

## Filtering and Views

TaskNotes uses Obsidian's Bases engine for filtering, sorting, and grouping. Each view is a `.base` file, so you can inspect or edit its query logic directly instead of relying on hidden plugin state.

This design also makes view customization practical: you can duplicate a default view, tweak grouping or formulas, and keep both versions side by side in your vault.

TaskNotes ships with several view types, each suited to a different way of working:

- **[Task List](views/task-list.md)** -- a filterable, sortable table
- **[Kanban](views/kanban-view.md)** -- a board grouped by status, priority, or any property
- **[Calendar](views/calendar-views.md)** -- month, week, and day scheduling
- **[Upcoming](views/upcoming-view.md)** -- time-grouped overview (Overdue, Today, This Week, Later)
- **[Agenda](views/agenda-view.md)** -- short-horizon daily planning

See [Views](views.md) for the full list, configuration options, and how to create your own. For details on how Bases integration works, see [Core Concepts](core-concepts.md#bases-integration). For Bases syntax documentation, see the [official Obsidian Bases documentation](https://help.obsidian.md/Bases/Introduction+to+Bases).

## Inline Task Integration

Inline task features let you work from normal notes without context switching. Task links can display interactive cards, checkboxes can be converted into full task notes, and project notes can surface subtasks and dependency relationships in place.

Natural language parsing supports date, priority, and context extraction across multiple languages, which helps keep fast capture while preserving structured data.

See [Inline Task Integration](features/inline-tasks.md) for details.

## Time Management

Time tracking records work sessions per task, and Pomodoro mode supports focused intervals with break handling. Over time, the statistics views help you compare estimated versus actual effort and spot trends in workload distribution.

![Pomodoro timer](assets/features/feature-pomodoro-timer.png)

See [Time Management](features/time-management.md) for details.

## Calendar Integration

TaskNotes supports bidirectional OAuth sync with Google Calendar and Microsoft Outlook, plus read-only ICS subscriptions for external feeds. Calendar views include month, week, day, year, and list modes, and drag-and-drop scheduling can update tasks directly.

For planning workflows, time-blocking and calendar-linked task updates connect backlog management with schedule execution in the same workspace.

![Calendar month view](assets/features/views-calendar-month.png)

See [Calendar Integration](features/calendar-integration.md) for details.

## View Notifications (experimental)

Enable notifications on any Bases view to get alerted when items match its filter. A toast notification appears with item counts, and a bell badge in the status bar keeps you informed. Notifications are separate from per-task reminders -- they watch view filters, not individual due dates.

> [!warning] This feature is experimental as of v4.3.50. Core functionality works, but edge cases remain. See [known issues](troubleshooting.md#notifications).

See [View Notifications](features/bases-notifications.md) for details.

## Team and Attribution

In a shared vault, TaskNotes maps each device to a person note using a locally stored device UUID. Tasks are attributed to people and groups, notifications filter to show only your assignments, and each person can override settings on their own device.

See [Team & Attribution](features/shared-vault.md) for details.

## Property Mapping

TaskNotes can remap non-core frontmatter properties to core task fields like due date, scheduled date, and assignee. Mapping works at two scopes: per-task (via the PropertyPicker in any task modal) and per-view (configured in `.base` files so all tasks created from that view inherit the mapping).

See [Property Mapping](features/property-mapping.md) for details.

## Property Migration

When you rename a property in settings, TaskNotes offers to update all affected files automatically. A bulk migration command is also available from the command palette for ad-hoc property renames. As long as you manage your frontmatter through Obsidian (or the TaskNotes API), property consistency is maintained automatically. Future versions will extend this consistency to the CLI and external integrations.

See [Property Migration](features/property-migration.md) for details.

## Integrations

Beyond calendar sync, TaskNotes includes an HTTP API and webhook support for automation workflows, external dashboards, or custom tooling.

See [Integrations](settings/integrations.md) for details.

## REST API

External applications can interact with TaskNotes through its REST API for automation, reporting, and integration with other tools.

See [HTTP API](HTTP_API.md) for details.
