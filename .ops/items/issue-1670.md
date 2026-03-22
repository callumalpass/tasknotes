---
id: 'github:callumalpass/tasknotes:issue:1670'
provider: github
kind: issue
key: '1670'
external_ref: callumalpass/tasknotes#1670
repo: callumalpass/tasknotes
number: 1670
remote_state: OPEN
remote_title: >-
  [FR]: Stop time tracking for all other tasks when starting the tracker for a task.
remote_author: sshilovsky
remote_url: 'https://github.com/callumalpass/tasknotes/issues/1670'
local_status: triaged
priority: medium
difficulty: easy
risk: low
summary: >-
  Feature request for exclusive time tracking mode: starting a timer on one task should
  automatically stop any running timer on other tasks.
notes: |-
  Root cause:
  - Not a bug. The PomodoroService (src/services/PomodoroService.ts) does not enforce mutual
    exclusivity of active timers across tasks. Multiple timers can run simultaneously.

  Suggested fix (preferred):
  - Add a setting (e.g. "exclusiveTimeTracking") that, when enabled, calls stopTimer() on the
    current session before starting a new one in PomodoroService.startSession(). The toggle
    preserves backward compatibility with the current multi-timer behavior.

  Fallback options:
  - Always stop existing timers when starting a new one without a setting toggle, simplifying
    implementation but removing multi-timer capability.
command_id: triage-issue
last_analyzed_at: '2026-03-22T00:00:00Z'
sync_state: clean
type: item_state
---
