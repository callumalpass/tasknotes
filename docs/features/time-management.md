# Time Management

TaskNotes includes features for time tracking and productivity, such as a time tracker and a Pomodoro timer.

## Time Tracking

TaskNotes has a time tracker to record the time spent on each task. Time tracking information is stored in the `timeEntries` array within each task's YAML frontmatter. Each time entry includes a start time and an end time.

Use **TaskNotes: Start time tracking for current task** and **TaskNotes: Stop time tracking for current task** from the Command Palette, hotkeys, or command-based plugins such as Buttons. These commands act on the currently open task note, not on a task link under the cursor, and do not open a selector. Starting an already running timer or stopping an inactive timer leaves entries unchanged and shows a notice. To track another task, use **TaskNotes: Start time tracking (select task)**.

The time tracking interface includes controls to start and stop tracking in task views and task cards. TaskNotes prevents duplicate active sessions on the same task. Active sessions on different tasks can exist at the same time, and total time spent on each task is calculated from completed sessions.

### Stop an Active Tracker Without Opening Its Note

Use **TaskNotes: Stop active time tracking**, or the square stop button beside the tracking timer in the desktop status bar. With one active tracker, the action stops it directly. With several, it opens a selector containing active tasks so you can stop one; cancelling leaves every tracker running. The selector cannot create new tasks. Other trackers keep running.

The command does not depend on the currently open note and can also be assigned a hotkey. The status bar's task title still opens the tracked note, while the stop button only stops tracking. If a task is deleted or its tracker stops before you choose it, no new time entry is created.

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

When a task is associated with a Pomodoro session, TaskNotes starts a task tracker if none is already running. Pomodoro only stops trackers it created; a pre-existing manual tracker is left running. After sleep or a delayed timer tick, a completed Pomodoro-owned tracker ends at the session's intended completion time, rather than the wake-up time.

## Recorded data

Version 5 removes the Statistics and Pomodoro statistics dashboards. Time tracking, the timer, session storage settings, recorded history, and the API remain available. No task notes or history are deleted. TaskNotes closes any statistics tabs left in your workspace.

New installs store each Pomodoro session in the `pomodoros` property of that day's daily note, creating the note if needed. If the Daily notes core plugin (or Periodic Notes) is off, or the daily note can't be created, the session is saved in the plugin's data file (`data.json`) instead, and still appears in your history. Vaults set up before this change keep using `data.json`. To change where sessions go, set **Pomodoro data storage** under `Settings → TaskNotes → Time & reminders`. Switching to **Daily notes** moves existing sessions from `data.json` into your daily notes.

To remove a session recorded by mistake, for example one left running overnight, open **Recent sessions** under the timer in the [Pomodoro View](../views/pomodoro-view.md) and select the delete button on its row. Deleting a session does not change the task's time entries.

### Pomodoro statistics Base

Run **TaskNotes: Open Pomodoro statistics** to open `TaskNotes/Views/pomodoro-stats.base`. TaskNotes creates this file if it is missing. Its **Daily** view lists one row per daily note with completed, attempted and interrupted Pomodoros, focus time, completion rate and breaks. Its **Monthly** view groups the same rows by month and totals them.

The Base reads the `pomodoros` property of your daily notes, so it only counts sessions stored in daily notes. Sessions kept in `data.json` are not included. The file is an ordinary Base that you can edit; see the [generated template reference](../reference/default-base-templates.md#pomodoro-statsbase) for its contents. To use a different file, change the path for **Pomodoro statistics base** under `Settings → TaskNotes → Appearance & interaction → Views & base files`.

### Time by project with Bases

A Bases table can total tracked time by project. Save the following as a `.base` file, for example `Time by project.base`:

```yaml
filters:
  and:
    - file.hasTag("task")
formulas:
  trackedMinutes: 'if(timeEntries, list(timeEntries).filter(value.endTime).map((number(date(value.endTime)) - number(date(value.startTime))) / 60000).reduce(acc + value, 0).round(), 0)'
  trackedLast7Days: 'if(timeEntries, list(timeEntries).filter(value.endTime && date(value.startTime) >= today() - "7d").map((number(date(value.endTime)) - number(date(value.startTime))) / 60000).reduce(acc + value, 0).round(), 0)'
views:
  - type: table
    name: Time by project
    filters:
      and:
        - formula.trackedMinutes > 0
    groupBy:
      property: projects
      direction: ASC
    order:
      - file.name
      - status
      - timeEstimate
      - formula.trackedMinutes
      - formula.trackedLast7Days
    summaries:
      timeEstimate: Sum
      formula.trackedMinutes: Sum
      formula.trackedLast7Days: Sum
```

Each project gets a group with the total estimate, total tracked minutes and minutes tracked in the last seven days. A task in several projects forms its own group. The example uses the default property names and the `task` tag; if you have changed them under `Settings → TaskNotes → Properties`, use your names instead. To count a different period, change `"7d"` to, for example, `"30d"`.
