---
id: issue-1627
provider: github
kind: issue
key: callumalpass/tasknotes#1627
external_ref: https://github.com/callumalpass/tasknotes/issues/1627
repo: callumalpass/tasknotes
number: 1627
remote_state: open
remote_title: "[FR]: Pomodoro overtime"
remote_author: "KFrancoD"
remote_url: https://github.com/callumalpass/tasknotes/issues/1627
local_status: triaged
priority: low
difficulty: medium
risk: low
summary: "FR: allow Pomodoro timer to continue counting past zero (overtime mode) if not manually stopped"
notes: |
  ## Root cause / Scope
  Currently `PomodoroService.ts` stops the timer when `timeRemaining` reaches 0 and advances to the next session. Users in flow state want the timer to keep running (counting up from 0) so they can see how much overtime they worked before manually stopping.

  ## Suggested fix / Approach
  Add an optional "Pomodoro overtime" setting. When enabled, instead of auto-completing when `timeRemaining` hits 0, switch the timer to count-up mode (negative or separate overtime counter) and emit a notification/sound but keep the session active. Manual stop would then log the full elapsed time including overtime. The PomodoroView would need UI to display the overtime count and distinguish it visually.
command_id: triage-issue
last_analyzed_at: "2026-03-31"
sync_state: clean
type: item_state
---
