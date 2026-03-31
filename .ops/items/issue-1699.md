---
id: issue-1699
provider: github
kind: issue
key: callumalpass/tasknotes#1699
external_ref: https://github.com/callumalpass/tasknotes/issues/1699
repo: callumalpass/tasknotes
number: 1699
remote_state: open
remote_title: "[FR]: Automatic Date Assignment on Status Change"
remote_author: "vanadium23"
remote_url: https://github.com/callumalpass/tasknotes/issues/1699
local_status: triaged
priority: low
difficulty: medium
risk: medium
summary: "FR: automatically write the current date to a configured date field when a task transitions to a specific status"
notes: |
  ## Root cause / Scope
  There is currently no mechanism to automatically stamp a date field when a task's status changes.
  The status configuration (`customStatuses`) supports labels, icons, and colors but not lifecycle
  hooks. This is a workflow automation FR for teams that track start dates, cancellation dates, etc.

  ## Suggested fix / Approach
  Add an optional `date_property` field to the status configuration type (`StatusConfig`). In
  `TaskService` (or `TaskActionCoordinator`), when a task's status is changed, check the target
  status config for a `date_property`. If set, write `today()` to that field as part of the same
  frontmatter update transaction. The settings UI should expose this as an optional date-field
  selector per status. This is analogous to the existing `autoArchive` behavior but more
  generalised.
command_id: triage-issue
last_analyzed_at: "2026-03-31"
sync_state: clean
type: item_state
---
