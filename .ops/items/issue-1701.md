---
id: issue-1701
provider: github
kind: issue
key: callumalpass/tasknotes#1701
external_ref: https://github.com/callumalpass/tasknotes/issues/1701
repo: callumalpass/tasknotes
number: 1701
remote_state: open
remote_title: "[Bug]: skipped instances aren't appearing in the skipped instances property"
remote_author: "Ruboks-Cube"
remote_url: https://github.com/callumalpass/tasknotes/issues/1701
local_status: triaged
priority: medium
difficulty: medium
risk: medium
summary: "Recurring task instances that are left undone are not automatically added to skipped_instances"
notes: |
  ## Root cause / Scope
  The `skipped_instances` property is only written when a user explicitly chooses "Skip instance"
  from the context menu (`TaskContextMenu.ts`, which calls `taskService.toggleRecurringTaskSkipped()`).
  There is no automatic mechanism that detects a missed (past, undone) recurrence and adds it to
  `skipped_instances`. The property tracks user-intentional skips, not missed occurrences. The user
  appears to expect that simply leaving a recurring instance without action would auto-populate this
  field, which is not the current design.

  ## Suggested fix / Approach
  Either clarify in documentation that `skipped_instances` requires explicit action, or implement
  an optional "auto-skip past instances" behavior: when advancing a recurring task's next occurrence
  (on completion or scheduled advancement), any occurrences between the old DTSTART and the new one
  that were not completed could be automatically added to `skipped_instances`. This would be an
  opt-in setting to avoid unexpected data changes.
command_id: triage-issue
last_analyzed_at: "2026-03-31"
sync_state: clean
type: item_state
---
