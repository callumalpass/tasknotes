---
id: 'github:callumalpass/tasknotes:issue:1638'
provider: github
kind: issue
key: '1638'
external_ref: callumalpass/tasknotes#1638
repo: callumalpass/tasknotes
number: 1638
remote_state: OPEN
remote_title: >-
  [Bug]: Incorrect Time Logging When Switching Tasks During Pomodoro
remote_author: katonapng
remote_url: 'https://github.com/callumalpass/tasknotes/issues/1638'
local_status: triaged
priority: high
difficulty: medium
risk: medium
summary: >-
  Switching tasks via "Change Task" during an active Pomodoro session does not
  stop time tracking on the old task or start it on the new task, resulting in
  missing startTime/endTime entries and incorrect task durations.
notes: |-
  Root cause:
  - `PomodoroView.selectTask()` (line ~764) calls `pomodoroService.assignTaskToCurrentSession(task)` which only updates the session's `taskPath` and saves state.
  - `assignTaskToCurrentSession()` in `PomodoroService.ts` (line 899) does NOT call `taskService.stopTimeTracking()` on the old task or `taskService.startTimeTracking()` on the new task.
  - When the Pomodoro completes, `completePomodoro()` logs the endTime only for the final task, leaving the original task with an open startTime and no endTime.

  Suggested fix (preferred):
  - In `PomodoroService.assignTaskToCurrentSession()`, before updating the task path:
    1. Stop time tracking on the previous task (if any) by calling `taskService.stopTimeTracking()`.
    2. Start time tracking on the new task by calling `taskService.startTimeTracking()`.
  - This mirrors the start/stop pattern already used in `startPomodoro()` and `pausePomodoro()`.

  Fallback options:
  - Add a warning notice when the user tries to switch tasks during an active Pomodoro, informing them that time tracking will only apply to the final task.
command_id: triage-issue
last_analyzed_at: '2026-03-22T00:00:00Z'
sync_state: clean
type: item_state
---
