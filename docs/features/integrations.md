
# Integrations

TaskNotes integrates with other Obsidian plugins.

[← Back to Features](../features.md)

## Bases

TaskNotes integrates with the [Bases plugin](https://github.com/obsidian-community/obsidian-bases). This allows you to use your tasks as a data source in your Bases databases.

### Features

- **Task Views**: TaskNotes provides three views for Bases: "Task List", "Kanban", and "Calendar".
- **Task Properties**: Task properties are displayed on the task cards in the Bases views.
- **Formula Computation**: Use Bases formulas to perform calculations on your task data.

### Getting Started

To use the Bases integration, you need to have both the TaskNotes and Bases plugins installed and enabled. Bases 1.10.0 or higher is required for Calendar view support.

1. **Enable the Integration**: Open **Settings → TaskNotes → Integrations** and enable the "Bases integration" toggle (restart Obsidian after changing this setting).
2. **Create a View**: In Bases, create a new view and select either the "TaskNotes Task List", "TaskNotes Kanban", or "TaskNotes Calendar" view.

Your tasks will now be available in the Bases view.

### Calendar View

The Calendar view (requires Bases 1.10.0+) provides multiple viewing modes and supports both task-based and property-based events:

#### View Modes

- Month view
- Week view
- Day view
- Year view
- List view

#### Event Types

The Calendar view can display multiple types of events:

- Tasks with scheduled dates
- Tasks with due dates
- Recurring task instances
- Time tracking entries
- Timeblocks from daily notes
- Property-based events from any notes in the Bases source

#### Property-Based Events

Property-based events allow you to display any notes from your Bases source on the calendar by specifying which date properties to use:

- Configure start date property, end date property, and title property in settings
- Date values can be stored as date properties or text properties containing ISO dates
- Notes with invalid date values are handled gracefully
- Drag-and-drop support updates the date properties in frontmatter

#### Layout and Display Options

- Time format (12-hour or 24-hour)
- Weekend visibility toggle
- All-day event slot display
- Today button and highlight
- Configurable scroll time
- Adjustable event height
- Individual visibility toggles for each event type

#### Date Navigation

Configure how the calendar determines its initial display date:

- Hardcoded date option: Set a specific date (YYYY-MM-DD format) for the calendar to display on load
- Property-based navigation: Automatically navigate to dates from filtered note properties
- Three navigation strategies: First result, Earliest date, or Latest date
- Supports both static views and dynamic filtered views

#### List View

The list view displays events in a chronological format with custom card rendering for different event types:

- Task cards show status, priority, and other task properties
- Timeblock cards display duration and associated tasks
- ICS event cards show event details from subscribed calendars
- Property-based event cards display the note title and date range
