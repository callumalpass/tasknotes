---
id: issue-1638
provider: github
kind: issue
key: callumalpass/tasknotes#1638
external_ref: https://github.com/callumalpass/tasknotes/issues/1638
repo: callumalpass/tasknotes
number: 1638
remote_state: open
remote_title: "[Bug]: Incorrect Time Logging When Switching Tasks During Pomodoro"
remote_author: "katonapng"
remote_url: https://github.com/callumalpass/tasknotes/issues/1638
local_status: triaged
priority: medium
difficulty: medium
risk: medium
summary: "assignTaskToCurrentSession() swaps the taskPath on the active session without stopping time tracking on the old task or starting it on the new one, corrupting time logs"
notes: |
  ## Root cause / Scope
  In `PomodoroService.ts`, `assignTaskToCurrentSession()` (line 899) only updates `this.state.currentSession.taskPath` to the new task's path without calling `stopTimeTracking` on the previously-tracked task or `startTimeTracking` on the new one. The time tracking entries (startTime/endTime in `timeEntries`) are written via `TaskService.startTimeTracking`/`stopTimeTracking`. When the task is swapped mid-session, the old task's open time entry never receives an `endTime`, and the new task never gets a `startTime` for the current period. When the Pomodoro completes, only the final `taskPath` gets an `endTime` recorded, but since no `startTime` was written for it, the entry is malformed. If the new task already had an open entry from before, a spurious `endTime` will be logged against it.

  ## Suggested fix / Approach
  In `assignTaskToCurrentSession()`, before changing `taskPath`: (1) call `stopTimeTracking` on the current task if it is set and the timer is running, (2) update `taskPath`, (3) call `startTimeTracking` on the new task if the timer is still running. Mirror the same start/stop pattern used in `pausePomodoro`/`resumePomodoro`. Add a guard so these calls are skipped if the Pomodoro is not currently running (paused state).
command_id: triage-issue
last_analyzed_at: "2026-03-31"
sync_state: clean
type: item_state
---
