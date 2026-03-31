---
id: issue-1676
provider: github
kind: issue
key: callumalpass/tasknotes#1676
external_ref: https://github.com/callumalpass/tasknotes/issues/1676
repo: callumalpass/tasknotes
number: 1676
remote_state: open
remote_title: "[FR]: Quick-Action Button in TaskView for rescheduling to today"
remote_author: "steven-murray"
remote_url: https://github.com/callumalpass/tasknotes/issues/1676
local_status: triaged
priority: low
difficulty: easy
risk: low
summary: "FR: Add a one-click 'reschedule to today' action icon in the task list/card view"
notes: |
  ## Root cause / Scope
  Rescheduling a task to today currently requires a right-click context menu → Scheduled → Today (multiple steps). Users with many tasks to reschedule daily find this high-friction. The task card action bar already has icons for recurrence and reminders; adding a "schedule to today" shortcut icon would reduce this to a single click.

  ## Suggested fix / Approach
  Add a new action icon (e.g. `calendar-check`) to the task card's action bar or as an inline button in the TaskList view row. The click handler would call the existing `TaskActionCoordinator` or `TaskContextMenu` logic to set `scheduledDate` to today's date. Optionally make the set of visible quick-action icons configurable per-view (the reporter also suggests this). Easy effort for the basic icon; medium if a full customization system is desired.
command_id: triage-issue
last_analyzed_at: "2026-03-31"
sync_state: clean
type: item_state
---
