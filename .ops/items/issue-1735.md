---
id: issue-1735
provider: github
kind: issue
key: callumalpass/tasknotes#1735
external_ref: https://github.com/callumalpass/tasknotes/issues/1735
repo: callumalpass/tasknotes
number: 1735
remote_state: open
remote_title: "[FR]: Real-time scheduled property update for recurrent tasks (Auto-catchup)"
remote_author: "Leonard-44"
remote_url: https://github.com/callumalpass/tasknotes/issues/1735
local_status: triaged
priority: low
difficulty: hard
risk: high
summary: "Feature request to automatically advance the 'scheduled' date of recurring tasks on startup or date change without user manually completing them"
notes: |
  ## Root cause / Scope
  Currently recurrence only advances when the user marks a task complete. The user wants the plugin to detect that today's date is past the scheduled date, compute the next occurrence via the RRULE, write it back to the YAML frontmatter, and optionally preserve the previous date in a secondary field (e.g. `scheduled_last`). This is a significant design change that interacts with the recurrence engine in `TaskUpdateService`, file-writing logic, and potentially introduces data mutation on vault load — which carries risks of data loss if the user wants to keep the original scheduled date for reporting.

  ## Suggested fix / Approach
  Add an optional plugin setting ("Auto-advance overdue recurring tasks on startup"). On `onload` / daily check, scan tasks with recurrence rules whose scheduled date is in the past, compute the next occurrence using the existing RRULE logic, write the updated date, and store the previous value in a configurable secondary property. Gate behind the setting with a clear warning about data mutation.
command_id: triage-issue
last_analyzed_at: "2026-03-31"
sync_state: clean
type: item_state
---
