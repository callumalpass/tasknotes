---
id: issue-1700
provider: github
kind: issue
key: callumalpass/tasknotes#1700
external_ref: https://github.com/callumalpass/tasknotes/issues/1700
repo: callumalpass/tasknotes
number: 1700
remote_state: open
remote_title: "[FR]: Selective export to google calendar based on folder or context"
remote_author: "hokfujow"
remote_url: https://github.com/callumalpass/tasknotes/issues/1700
local_status: triaged
priority: low
difficulty: medium
risk: low
summary: "FR: filter which tasks are exported to Google Calendar by folder path or context tag"
notes: |
  ## Root cause / Scope
  The Google Calendar export currently syncs all tasks that have a scheduled/due date and are not
  archived. There is no mechanism to restrict export by folder, context, tag, or any other filter.
  Users with mixed personal/work vaults want to export only personal tasks.

  ## Suggested fix / Approach
  Add optional filter settings to the Google Calendar export configuration: an include/exclude
  folder path list and/or a context/tag filter. In `TaskCalendarSyncService.shouldSyncTask()`,
  evaluate these filters against the task's file path and context fields before proceeding with
  sync. This is a targeted extension of the existing `shouldSyncTask` guard.
command_id: triage-issue
last_analyzed_at: "2026-03-31"
sync_state: clean
type: item_state
---
