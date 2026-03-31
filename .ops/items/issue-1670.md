---
id: issue-1670
provider: github
kind: issue
key: callumalpass/tasknotes#1670
external_ref: https://github.com/callumalpass/tasknotes/issues/1670
repo: callumalpass/tasknotes
number: 1670
remote_state: open
remote_title: "[FR]: Stop time tracking for all other tasks when starting the tracker for a task."
remote_author: "sshilovsky"
remote_url: https://github.com/callumalpass/tasknotes/issues/1670
local_status: triaged
priority: low
difficulty: easy
risk: low
summary: "FR: Option to auto-stop all other active time trackers when starting time tracking on a new task"
notes: |
  ## Root cause / Scope
  Currently `TaskActionCoordinator.startTimeTracking()` starts a new time entry without checking or stopping other tasks that may already have active time entries. Users who work on one task at a time want exclusive tracking behavior to avoid accidentally having multiple concurrent trackers running.

  ## Suggested fix / Approach
  Add a boolean setting (e.g. `exclusiveTimeTracking`) that, when enabled, causes `startTimeTracking` in `TaskActionCoordinator.ts` to first scan all tasks for active time entries and call `stopTimeTracking` on each before starting the new one. The `cacheManager.getAllTasks()` and `getActiveTimeEntry()` helper are already available. This is an easy single-setting + single-function change.
command_id: triage-issue
last_analyzed_at: "2026-03-31"
sync_state: clean
type: item_state
---
