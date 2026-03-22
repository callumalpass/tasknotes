---
id: 'github:callumalpass/tasknotes:issue:1627'
provider: github
kind: issue
key: '1627'
external_ref: callumalpass/tasknotes#1627
repo: callumalpass/tasknotes
number: 1627
remote_state: OPEN
remote_title: >-
  [FR]: Pomodoro overtime
remote_author: KFrancoD
remote_url: 'https://github.com/callumalpass/tasknotes/issues/1627'
local_status: triaged
priority: low
difficulty: medium
risk: low
summary: >-
  Feature request to allow the Pomodoro timer to continue counting elapsed time
  after the session ends, rather than stopping automatically, so users can see
  how much extra time they spent.
notes: |-
  Root cause:
  - Not a bug. Currently PomodoroService calls completePomodoro() when the
    timer worker sends a "done" message (timer reaches zero), which stops
    the timer and records the session.

  Suggested fix (preferred):
  - Add an "overtime" mode setting. When enabled, after the timer reaches
    zero, instead of calling completePomodoro(), switch to a count-up mode
    that continues tracking elapsed time and shows negative remaining time
    or a separate overtime counter in the UI.
  - PomodoroService.ts would need a new state (e.g., isOvertime) and the
    timer worker would need to continue ticking past zero.
  - PomodoroView.ts would need UI changes to display the overtime counter.

  Fallback options:
  - Simpler approach: just add a setting to auto-pause instead of auto-
    complete when the timer reaches zero. The user can then manually stop
    when ready, and elapsed time is recorded including the extra time.
command_id: triage-issue
last_analyzed_at: '2026-03-22T00:00:00Z'
sync_state: clean
type: item_state
---
