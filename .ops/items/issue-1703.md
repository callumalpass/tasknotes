---
id: issue-1703
provider: github
kind: issue
key: callumalpass/tasknotes#1703
external_ref: https://github.com/callumalpass/tasknotes/issues/1703
repo: callumalpass/tasknotes
number: 1703
remote_state: open
remote_title: "[FR]: Trigger clear scheduled date when change status to in-progress"
remote_author: "kmaustral"
remote_url: https://github.com/callumalpass/tasknotes/issues/1703
local_status: triaged
priority: low
difficulty: medium
risk: medium
summary: "FR: automatically clear the scheduled date when a task transitions to in-progress status"
notes: |
  ## Root cause / Scope
  This is closely related to issue #1699 (automatic date assignment on status change) but requests
  the inverse: clearing a date field on status transition rather than setting one. The user's workflow
  requires manual clearing of `scheduled` every time they move a task to in-progress. Currently there
  is no lifecycle hook in the status configuration to clear fields.

  ## Suggested fix / Approach
  As part of the #1699 implementation, the status configuration could support a `clear_properties`
  list alongside `date_property`. When a task transitions to the configured status, fields listed in
  `clear_properties` are set to null/removed. Alternatively, a specific "clear scheduled on
  in-progress" toggle could be added as a simpler first step. This change would live in
  `TaskService` / `TaskActionCoordinator` alongside the status-change handling logic.
command_id: triage-issue
last_analyzed_at: "2026-03-31"
sync_state: clean
type: item_state
---
