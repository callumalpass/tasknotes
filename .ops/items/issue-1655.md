---
id: 'github:callumalpass/tasknotes:issue:1655'
provider: github
kind: issue
key: '1655'
external_ref: callumalpass/tasknotes#1655
repo: callumalpass/tasknotes
number: 1655
remote_state: OPEN
remote_title: >-
  [FR]: Timer Widget For Task Time Tracking
remote_author: connradolisboa
remote_url: 'https://github.com/callumalpass/tasknotes/issues/1655'
local_status: triaged
priority: low
difficulty: hard
risk: medium
summary: >-
  Feature request for a visible elapsed-time widget during active time tracking
  sessions. Currently, time tracking runs in the background with no live counter
  visible to the user outside the Pomodoro view.
notes: |-
  Root cause:
  - `PomodoroService` has a timer with tick events (`EVENT_POMODORO_TICK`) but this only applies to Pomodoro sessions, not general time tracking.
  - `TaskService.startTimeTracking()` records a startTime but provides no ongoing tick/display mechanism.
  - The status bar (`StatusBarService`) could show elapsed time but currently does not display a live counter for active time tracking sessions.

  Suggested fix (preferred):
  - Add a status bar widget or floating timer that displays elapsed time when `TaskService` has an active time tracking session.
  - Subscribe to a periodic tick (e.g., 1-second interval) that updates the display, similar to `PomodoroService`'s worker-based tick.
  - Allow clicking the widget to stop tracking or switch to the tracked task.

  Fallback options:
  - Extend the existing Pomodoro view to also display non-Pomodoro time tracking sessions.
  - Add a command palette action to check current elapsed time.
command_id: triage-issue
last_analyzed_at: '2026-03-22T00:00:00Z'
sync_state: clean
type: item_state
---
