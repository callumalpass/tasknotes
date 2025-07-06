# Workflows

This page documents common workflows and use cases for TaskNotes, showing how to combine different features to accomplish specific goals.

## Habit Tracking with Recurring Tasks

TaskNotes supports habit tracking through its recurring task system. Recurring tasks can be created with various patterns and completion status can be tracked using the calendar interface in the task edit modal.

### Creating Recurring Tasks for Habits

#### Natural Language Creation

TaskNotes recognizes recurring patterns in natural language and converts them to RRule format:

- **Daily patterns**: "Exercise daily", "Meditate every day"
- **Weekly patterns**: "Go to gym every Monday", "Weekly team meeting"
- **Interval patterns**: "Water plants every 3 days", "Review goals every other week"
- **Monthly patterns**: "Pay bills monthly", "Clean car every first Saturday"

Examples:
- "Morning meditation daily at 7am" → Creates a daily recurring task scheduled for 7:00 AM
- "Gym every Monday and Wednesday" → Creates a weekly recurring task for specific days
- "Review monthly goals every last Friday" → Creates a monthly recurring task on the last Friday

#### Manual Recurrence Configuration

The recurrence context menu in the task creation or edit modal provides options for:

- **Frequency**: Daily, weekly, monthly, yearly
- **Intervals**: Every N days/weeks/months/years
- **Specific days**: Choose exact weekdays for weekly patterns
- **Ordinal patterns**: First/second/third/last occurrence of a weekday
- **End conditions**: Never end, end after N occurrences, or end by a specific date

### Tracking Completion

The recurring task calendar appears automatically in the task edit modal for any task with a recurrence pattern. This calendar provides:

#### Basic Usage

1. Open any recurring task for editing (double-click the task or use "Edit task" command)
2. The calendar widget appears in the edit modal showing the recurrence pattern
3. Navigate through months using the arrow buttons
4. Click on dates to toggle completion status for specific instances
5. Completed dates are visually distinct from incomplete ones
6. Save changes to store completion data

#### Data Storage

- Completion status is stored in the `complete_instances` field as an array of dates
- Each date represents a specific day when the habit was completed
- The calendar shows all recurring instances based on the recurrence pattern
- Past and future dates can be marked as complete or incomplete

### Example Habit Configurations

#### Daily Habits
```yaml
title: Morning Exercise
recurrence: "FREQ=DAILY"
scheduled: "07:00"
complete_instances: 
  - "2025-01-01"
  - "2025-01-02"
  - "2025-01-04"
```

Daily exercise habit scheduled for 7 AM, with completion tracked for January 1st, 2nd, and 4th.

#### Weekly Habits
```yaml
title: Meal Prep Sunday
recurrence: "FREQ=WEEKLY;BYDAY=SU"
complete_instances:
  - "2025-01-05"
  - "2025-01-12"
```

Weekly meal prep habit every Sunday, with completion tracked for specific Sundays.

#### Custom Interval Habits
```yaml
title: Deep Work Session
recurrence: "FREQ=DAILY;INTERVAL=3"
complete_instances:
  - "2025-01-01"
  - "2025-01-04"
  - "2025-01-07"
```

Habit that recurs every 3 days, suitable for activities that don't require daily repetition.

### Viewing Habit Progress

#### Calendar Views
- **Advanced Calendar View**: Shows all habit instances as events across monthly/weekly/daily views
- **Agenda View**: Lists upcoming habit instances chronologically
- **Filter options**: Use the "Show Recurrent" filter to display only recurring tasks

#### Progress Visualization
The recurring task calendar in the edit modal provides:
- **Pattern recognition**: Visual identification of streaks and gaps in completion
- **Monthly overview**: Complete month's progress at a glance
- **Historical tracking**: Navigation to previous months for past performance review

### Habit Organization Strategies

#### Related Habit Grouping
Multiple related habits can be linked using projects or contexts:
```yaml
title: Morning Routine - Meditation
recurrence: "FREQ=DAILY"
scheduled: "06:30"
contexts: ["@morning"]
projects: ["[[Morning Routine]]"]
```

#### Time-Based Habits
Recurring tasks can be combined with time tracking and Pomodoro features:
```yaml
title: Focused Reading
recurrence: "FREQ=DAILY"
scheduled: "20:00"
time_estimate: 25
```

Daily reading habit with a 25-minute time estimate, suitable for Pomodoro-style focus sessions.

#### Progressive Habits
Habits can be modified over time by editing the recurrence pattern:
1. Start with simple patterns (e.g., `FREQ=DAILY`)
2. Add time estimates and scheduling
3. Adjust frequency or intervals as needed (e.g., `FREQ=DAILY;INTERVAL=2`)

### Implementation Notes

- The calendar interface requires saving the edit modal to persist completion changes
- Recurring instances are generated based on RRule patterns
- Completion tracking is independent of task status (a recurring task can remain "open" while tracking daily completions)
- The recurrence pattern can be modified without losing existing completion data
- Calendar navigation allows review of completion patterns across multiple months