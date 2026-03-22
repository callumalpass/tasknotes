---
id: 'github:callumalpass/tasknotes:issue:1642'
provider: github
kind: issue
key: '1642'
external_ref: callumalpass/tasknotes#1642
repo: callumalpass/tasknotes
number: 1642
remote_state: OPEN
remote_title: >-
  [FR]: monthly/yearly without without specifying a day
remote_author: Volker-brdb
remote_url: 'https://github.com/callumalpass/tasknotes/issues/1642'
local_status: triaged
priority: low
difficulty: medium
risk: low
summary: >-
  The recurrence modal forces the user to select a specific day of the month
  when choosing monthly or yearly frequency with "recur from completion date"
  mode. The day picker should be optional for flexible-schedule recurrences.
notes: |-
  Root cause:
  - The recurrence configuration modal in `src/modals/TaskModal.ts` requires a day-of-month selection for monthly/yearly frequencies regardless of whether "recur from completion date" (flexible schedule) is selected.
  - For flexible schedules, the next occurrence is calculated relative to the completion date, so pinning a specific day-of-month is semantically incorrect and blocks the user.

  Suggested fix (preferred):
  - Make the day-of-month picker conditional: only require it when the recurrence mode is "fixed schedule." When "flexible schedule" is selected for monthly/yearly, skip the day selection step and calculate the next occurrence as "N months/years from completion date."

  Fallback options:
  - Pre-fill the day-of-month with the current day (as weekly already does) and allow the user to proceed without explicit selection.
command_id: triage-issue
last_analyzed_at: '2026-03-22T00:00:00Z'
sync_state: clean
type: item_state
---
