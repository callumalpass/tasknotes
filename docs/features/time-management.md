# Time Management

TaskNotes includes features for time tracking and productivity, such as a time tracker and a Pomodoro timer.

## Time Tracking

TaskNotes has a time tracker to record the time spent on each task. Time tracking information is stored in the `timeEntries` array within each task's YAML frontmatter. Each time entry includes a start time and an end time.

The time tracking interface includes controls to start and stop tracking, which appear in task views and on task cards. Only one task can be actively tracked at a time; starting a new timer will automatically stop the previous one. The total time spent on a task is calculated from all completed sessions.

### Auto-Stop Time Tracking

TaskNotes can automatically stop time tracking when a task is marked as completed. This feature helps ensure that time tracking accurately reflects the work done on tasks without requiring manual intervention.

**Key Features:**
- Automatically stops active time tracking when any task is completed
- Optional notification when auto-stop occurs (disabled by default)
- Configurable through plugin settings
- Works across all task views and completion methods

This feature is enabled by default but can be disabled in the plugin settings if you prefer manual control over time tracking.

## Pomodoro Timer

TaskNotes also includes a Pomodoro timer, which is a tool for time management that uses a timer to break down work into intervals, separated by short breaks. The Pomodoro timer in TaskNotes has a dedicated view with controls to start, stop, and reset the timer.

When a task is associated with a Pomodoro session, the time is automatically recorded in the task's time tracking data upon completion of the session.

## Productivity Analytics

The **Pomodoro Stats View** provides analytics and historical data about your Pomodoro sessions. This includes a history of completed sessions, as well as metrics like completion rates and total time spent on tasks. The data can be visualized to show productivity patterns over time.