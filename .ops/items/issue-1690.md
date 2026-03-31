---
id: issue-1690
provider: github
kind: issue
key: callumalpass/tasknotes#1690
external_ref: https://github.com/callumalpass/tasknotes/issues/1690
repo: callumalpass/tasknotes
number: 1690
remote_state: open
remote_title: "Feature Request: Option to delete Google Calendar event when task is completed"
remote_author: "Flowburghardt"
remote_url: https://github.com/callumalpass/tasknotes/issues/1690
local_status: triaged
priority: low
difficulty: easy
risk: low
summary: "FR: add a 'delete on complete' option for Google Calendar sync so completed tasks are removed from GCal"
notes: |
  ## Root cause / Scope
  Currently `TaskCalendarSyncService.completeTaskInCalendar()` only prepends a checkmark to the
  event title when `syncOnTaskComplete: true`. The `deleteTaskFromCalendar()` method already exists
  and works. There is no setting to control deletion-on-completion as an alternative behavior.

  ## Suggested fix / Approach
  Add a new setting (e.g., `completionBehavior: 'update' | 'delete' | 'none'`) to the Google Calendar
  export settings. In `completeTaskInCalendar()`, branch on this setting: call
  `deleteTaskFromCalendar()` when set to `'delete'`, or apply the existing checkmark prefix when
  set to `'update'`. The author has provided a clear code sketch. The settings UI should expose
  this as a dropdown in the Google Calendar Export settings tab.
command_id: triage-issue
last_analyzed_at: "2026-03-31"
sync_state: clean
type: item_state
---
