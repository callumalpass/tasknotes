---
id: issue-1724
provider: github
kind: issue
key: callumalpass/tasknotes#1724
external_ref: https://github.com/callumalpass/tasknotes/issues/1724
repo: callumalpass/tasknotes
number: 1724
remote_state: open
remote_title: "[FR]: improvement to mobile edit menu for recurring tasks"
remote_author: "prepare4robots"
remote_url: https://github.com/callumalpass/tasknotes/issues/1724
local_status: triaged
priority: low
difficulty: easy
risk: low
summary: "Feature request to move recurring-task instance actions (mark complete for date, skip instance) from between Status and Priority to the Date section of the mobile context menu"
notes: |
  ## Root cause / Scope
  In src/components/TaskContextMenu.ts, the recurring-instance actions (markComplete / skipInstance) are inserted at the top of the menu body before the Status/Priority/Date items because the code renders them immediately after the separator at the top of the if(isRecurring) block (~lines 60-120). On mobile this produces an unintuitive ordering where date-specific actions appear mid-menu between Status and Priority rather than grouped with the date section.

  ## Suggested fix / Approach
  Move the recurring instance action items (mark complete for date, skip instance) to be rendered after the Scheduled Date submenu item or in a dedicated "This occurrence" section near the Date items. The change is isolated to the ordering of menu.addItem() calls in TaskContextMenu.ts and has no functional impact on the actions themselves.
command_id: triage-issue
last_analyzed_at: "2026-03-31"
sync_state: clean
type: item_state
---
