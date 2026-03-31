---
id: issue-1655
provider: github
kind: issue
key: callumalpass/tasknotes#1655
external_ref: https://github.com/callumalpass/tasknotes/issues/1655
repo: callumalpass/tasknotes
number: 1655
remote_state: open
remote_title: "[FR]: Timer Widget For Task Time Tracking"
remote_author: "connradolisboa"
remote_url: https://github.com/callumalpass/tasknotes/issues/1655
local_status: triaged
priority: low
difficulty: medium
risk: low
summary: "Feature request: show an elapsed-time widget/display when time tracking is active on a task"
notes: |
  ## Root cause / Scope
  Currently when time tracking starts on a task, there is no visible real-time elapsed timer shown to the user. The time tracking data is recorded (via `timeTrackingUtils.ts` and related services) but there is no live display component. The Pomodoro feature does have a real-time countdown (`PomodoroView.ts`), so the UI infrastructure for a live timer exists.

  ## Suggested fix / Approach
  Add a small elapsed-time widget (similar to the Pomodoro countdown) that activates when time tracking is running on a task. This could be: (1) a status bar indicator showing elapsed time for the active tracking session; (2) a badge on the task card. The implementation would subscribe to time-tracking state changes and update a DOM element via `setInterval`. Medium complexity; leverages existing timer display patterns from `PomodoroView.ts`.
command_id: triage-issue
last_analyzed_at: "2026-03-31"
sync_state: clean
type: item_state
---
