# Time Management

TaskNotes includes features for time tracking and productivity, such as a time tracker and a Pomodoro timer.

## Time Tracking

TaskNotes has a time tracker to record the time spent on each task. Time tracking information is stored in the `timeEntries` array within each task's YAML frontmatter. Each time entry includes a start time and an end time.

Use **TaskNotes: Start time tracking for current task** and **TaskNotes: Stop time tracking for current task** from the Command Palette, hotkeys, or command-based plugins such as Buttons. These commands act on the currently open task note, not on a task link under the cursor, and do not open a selector. Starting an already running timer or stopping an inactive timer leaves entries unchanged and shows a notice. To track another task, use **TaskNotes: Start time tracking (select task)**.

The time tracking interface includes controls to start and stop tracking in task views and task cards. TaskNotes prevents duplicate active sessions on the same task. Active sessions on different tasks can exist at the same time, and total time spent on each task is calculated from completed sessions.

### Auto-Stop Time Tracking

TaskNotes can automatically stop time tracking when a task is marked as completed. This feature ensures that time tracking data accurately reflects work completion without requiring manual timer management.

The auto-stop feature works by monitoring task status changes across all views and interfaces. When a task's status changes from any non-completed state to a completed state (as defined by the custom status configuration), any active time tracking session for that task is automatically terminated.

**Configuration Options:** Configure these under `Settings → TaskNotes → Time & reminders` (Time Tracking section).

- **Auto-stop tracking** - Enable or disable the automatic stopping behavior (enabled by default)
- **Completion notification** - Show a notice when auto-stop occurs (disabled by default)

**Behavior:**

- Monitors all task status changes in real-time
- Stops only the specific task that was completed (other active timers continue)
- Preserves the recorded time data in the task's time entries
- Works with both standard and recurring task completions
- Functions across all task views (list, kanban, calendar, etc.)

The feature integrates with the custom status system, so completion detection respects your configured workflow statuses rather than relying on hardcoded completion states.

## Pomodoro Timer

TaskNotes also includes a Pomodoro timer, which is a tool for time management that uses a timer to break down work into intervals, separated by short breaks. The Pomodoro timer in TaskNotes has a dedicated view with controls to start, stop, and reset the timer.

When a task is associated with a Pomodoro session, the time is automatically recorded in the task's time tracking data upon completion of the session.

## Recorded data

Version 5 removes the Statistics and Pomodoro statistics dashboards and no longer generates a Pomodoro statistics Base. Time tracking, the timer, session storage settings, recorded history, and the API remain available. Existing statistics Base files are kept as ordinary user-editable Bases. No task notes or history are deleted. Close any old statistics dashboard tabs after upgrading.
