# Time Tracking

TaskNotes includes built-in time tracking functionality that allows you to measure how much time you spend on individual tasks. Time tracking data is stored directly in each task's YAML frontmatter, ensuring your time data remains with your tasks.

## Time Entry System

### Data Storage

Time tracking information is stored in the `timeEntries` array within each task's YAML frontmatter. Each time entry contains:

**Start Time**: ISO timestamp when work began on the task
**End Time**: ISO timestamp when work stopped (if session is complete)
**Duration**: (Calculated from start and end times for completed sessions)

### Multiple Sessions

Tasks can have multiple time tracking sessions:

- Each work session creates a separate time entry
- Historical sessions are preserved for reference
- Total time is calculated from all completed sessions

## Time Tracking Interface

### Start/Stop Controls

Time tracking controls appear in task views and cards:

**Start Button**: Begins a new time tracking session for the task
**Stop Button**: Ends the current active session
**Active Indicators**: Visual feedback showing which tasks have active time tracking

### Duration Display

**Formatted Time**: Time is displayed in hours:minutes format (e.g., "2:30" for 2 hours 30 minutes)
**Real-Time Updates**: Active session times update in real-time across all views
**Total Time**: Displays cumulative time from all sessions

### Session Management

**Single Active Session**: Only one task can have active time tracking at a time
**Automatic Stop**: Starting time tracking on a new task automatically stops the previous session
**Session Persistence**: Active sessions persist across Obsidian restarts

## Integration with Views

### Task Card Display

Task cards across all views show time tracking information:

- Current session duration if actively tracking
- Total accumulated time for completed sessions
- Visual indicators for active time tracking status

### Real-Time Updates

**Proactive Cache Updates**: Time tracking changes immediately update the task cache
**Cross-View Synchronization**: Starting or stopping time tracking updates all open views instantly
**Performance Optimization**: Updates only affect the specific task being tracked

## Pomodoro Integration

### Automatic Time Tracking

When using the pomodoro timer with a selected task:

**Session Start**: Starting a pomodoro automatically begins time tracking for the associated task
**Session Stop**: Completing or stopping a pomodoro automatically stops time tracking
**Break Handling**: Time tracking pauses during pomodoro break periods

### Task-Less Pomodoro

Pomodoro sessions can run without an associated task:

- Time tracking only occurs when a task is selected
- Session statistics are maintained regardless of task association
- Users can add task association during active sessions

## Time Entry Management

### Session History

**Complete History**: All time entries are preserved in the task's frontmatter
**Session Details**: Each entry includes precise start and stop times
**Data Integrity**: Time data remains with the task file for portability

### Manual Editing

Time entries can be manually edited by modifying the task's YAML frontmatter:

```yaml
timeEntries:
  - startTime: "2024-01-15T10:30:00.000Z"
    endTime: "2024-01-15T12:00:00.000Z"
  - startTime: "2024-01-16T14:00:00.000Z"
    endTime: "2024-01-16T15:30:00.000Z"
```

### Data Validation

**Format Validation**: Time entries use ISO timestamp format for consistency
**Error Handling**: Invalid time data is handled gracefully without breaking functionality

## Performance Considerations

### Efficient Updates

**Minimal Processing**: Only the active tracking task requires real-time updates
**Cache Integration**: Time tracking integrates with TaskNotes' minimal caching system
**Event-Driven Updates**: UI updates occur only when time tracking state changes

### Memory Management

**Active Session Tracking**: System tracks only the currently active session in memory
**Cleanup Procedures**: Proper cleanup when switching between tasks or stopping tracking
**Persistence**: Active sessions are saved to ensure no data loss

## Use Cases and Workflows

### Time Estimation Improvement

**Comparison Data**: Compare actual time spent with initial time estimates
**Planning Accuracy**: Improve future time estimates based on historical data
**Pattern Recognition**: Identify tasks that consistently take longer than expected

### Productivity Analysis

**Task Duration Patterns**: Understand which types of tasks take most time
**Work Session Analysis**: Identify optimal work session lengths
**Time Distribution**: See how time is distributed across different projects or contexts

### Client Work and Billing

**Detailed Records**: Precise start/stop times for accurate billing
**Task-Based Tracking**: Time tracking tied directly to specific work items
**Data Export**: Time data can be extracted from YAML frontmatter for external processing

