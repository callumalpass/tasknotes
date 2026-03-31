---
id: issue-1712
provider: github
kind: issue
key: callumalpass/tasknotes#1712
external_ref: https://github.com/callumalpass/tasknotes/issues/1712
repo: callumalpass/tasknotes
number: 1712
remote_state: open
remote_title: "[FR]: Quicker Access to Date Pickers (Due and Schedule)"
remote_author: "Glint-Eye"
remote_url: https://github.com/callumalpass/tasknotes/issues/1712
local_status: triaged
priority: low
difficulty: medium
risk: low
summary: "Feature request to reduce clicks needed to open the date picker for Due and Scheduled date fields"
notes: |
  ## Root cause / Scope
  Currently accessing the date picker requires navigating a context menu submenu (3-4 clicks). The user wants a shortcut — either a direct context menu entry that opens the date picker immediately, or a single click on the "Due Date" / "Scheduled Date" label in the task card.

  ## Suggested fix / Approach
  Add a top-level "Pick due date…" / "Pick scheduled date…" menu item in the context menu that bypasses the submenu and calls plugin.openDueDateModal() / the scheduled equivalent directly. Alternatively, make the date label in the task card clickable and wire it to the DateContextMenu or DateTimePickerModal. Both changes are localized to src/components/TaskContextMenu.ts and src/ui/TaskCard.ts respectively.
command_id: triage-issue
last_analyzed_at: "2026-03-31"
sync_state: clean
type: item_state
---
