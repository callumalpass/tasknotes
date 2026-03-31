---
id: issue-1635
provider: github
kind: issue
key: callumalpass/tasknotes#1635
external_ref: https://github.com/callumalpass/tasknotes/issues/1635
repo: callumalpass/tasknotes
number: 1635
remote_state: open
remote_title: "[FR]: Track number of changes to due/scheduled"
remote_author: "stil-sudo"
remote_url: https://github.com/callumalpass/tasknotes/issues/1635
local_status: triaged
priority: low
difficulty: medium
risk: low
summary: "FR: add optional frontmatter counters that increment each time the due or scheduled date is changed"
notes: |
  ## Root cause / Scope
  No mechanism currently records how many times a task's due or scheduled date has been modified. For users managing frequently-rescheduled deadlines, this would surface tasks that are perpetually deferred. The feature would require incrementing a counter field (e.g., `dateRescheduleCount`) in frontmatter every time `TaskUpdateService` writes a new due/scheduled value that differs from the previous one.

  ## Suggested fix / Approach
  Add optional fields `dueChanges` and `scheduledChanges` (or a combined `rescheduleCount`) to the `TaskInfo` type and `FieldMapping`. In `TaskUpdateService.ts`, before writing the new date, compare it to the existing value and increment the relevant counter if different. Gate the feature behind a plugin setting so it is opt-in (avoids cluttering frontmatter for users who don't need it). The new fields should be filterable/sortable in Bases views.
command_id: triage-issue
last_analyzed_at: "2026-03-31"
sync_state: clean
type: item_state
---
