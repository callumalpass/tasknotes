# Advanced Settings

These settings provide customization options, such as field mapping, custom status and priority workflows.

## Field Mapping

**Field Mapping** allows you to customize the YAML property names that TaskNotes uses for its internal properties. This can be used for integrating with other plugins or for matching your existing vault structure. You can map all of the core task properties, including title, status, priority, due date, contexts, and projects, as well as other properties like time estimates and recurrence patterns.

## Custom Status System

TaskNotes allows you to define your own **Custom Status Workflows**. You can create as many statuses as you need, and you can customize their names, colors, and completion behavior. You can also set the order in which the statuses appear, which determines the progression of the workflow.

## Custom Priority System

You can also create a **Custom Priority System**. You can define as many priority levels as you need, and you can customize their names, colors, and weights. The weight of a priority determines its importance, and is used for sorting and filtering.

## Pomodoro Timer Settings

You can configure the **Pomodoro Timer** from this section, including the duration of work and break sessions, as well as the notification settings. You can also choose where to store the Pomodoro session data.

### Time Tracking Auto-Stop

**Auto-stop time tracking on task completion** - Automatically stop active time tracking when any task is marked as completed. This ensures that time tracking accurately reflects the work done on tasks without requiring manual intervention. Enabled by default.

**Show notification when auto-stopping time tracking** - Display a notification when time tracking is automatically stopped due to task completion. This provides feedback when the auto-stop feature activates. Disabled by default to avoid notification clutter.

## Field Mapping

The Field Mapping section includes two additional fields for ICS integration:

**ICS Event ID** - Frontmatter field name for storing calendar event identifiers. Default is `icsEventId`. This field maintains the connection between vault content and calendar events.

**ICS Event Tag** - Tag used to identify content created from ICS events. Default is `ics_event`. This tag is automatically added to notes and tasks generated from calendar events.