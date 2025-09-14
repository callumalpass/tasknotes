
# Task Properties Settings

These settings allow you to define custom statuses, priorities, and user fields for your tasks.

[← Back to Settings](../settings.md)

## Task Statuses

Customize the status options available for your tasks. These statuses control the task lifecycle and determine when tasks are considered complete.

- **Value**: The internal identifier stored in your task files (e.g., "in-progress").
- **Label**: The display name shown in the interface (e.g., "In Progress").
- **Color**: Visual indicator color for the status dot and badges.
- **Completed**: When checked, tasks with this status are considered finished and may be filtered differently.
- **Auto-archive**: When enabled, tasks will be automatically archived after the specified delay (1-1440 minutes).

## Task Priorities

Customize the priority levels available for your tasks. Priority weights determine sorting order and visual hierarchy in your task views.

- **Value**: The internal identifier stored in your task files (e.g., "high").
- **Display Label**: The display name shown in the interface (e.g., "High Priority").
- **Color**: Visual indicator color for the priority dot and badges.
- **Weight**: Numeric value for sorting (higher weights appear first in lists).

## Field Mapping

Configure which frontmatter properties TaskNotes should use for each field. TaskNotes will read AND write using these property names. Changing these after creating tasks may cause inconsistencies.

## Custom User Fields

Define custom frontmatter properties to appear as type-aware filter options across views. Each row has a Display Name, Property Name, and Type.
