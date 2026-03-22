---
id: 'github:callumalpass/tasknotes:issue:1712'
provider: github
kind: issue
key: '1712'
external_ref: callumalpass/tasknotes#1712
repo: callumalpass/tasknotes
number: 1712
remote_state: OPEN
remote_title: >-
  [FR]: Quicker Access to Date Pickers (Due and Schedule)
remote_author: Glint-Eye
remote_url: 'https://github.com/callumalpass/tasknotes/issues/1712'
local_status: triaged
priority: low
difficulty: easy
risk: low
summary: >-
  Feature request to reduce the number of clicks needed to reach the date picker
  for due and scheduled dates. Currently requires 3-4 clicks through context
  menus or edit modal to reach a custom date picker.
notes: |-
  Root cause:
  - Not a bug. The date picker is nested behind context menu > date submenu > custom date option, or edit modal > date field > picker. The intermediate pre-made date options (today, tomorrow, etc.) add a step.

  Suggested fix (preferred):
  - Add direct "Set Due Date" and "Set Scheduled Date" entries to the top-level task context menu that immediately open the date picker modal, bypassing the preset options submenu.
  - Modify src/components/TaskContextMenu.ts to add these direct entries.

  Fallback options:
  - Make clicking the "Due Date" or "Scheduled Date" label in the context menu directly open the date picker instead of showing preset options first.
  - Add keyboard shortcuts for opening due/scheduled date pickers.
command_id: triage-issue
last_analyzed_at: '2026-03-22T00:00:00Z'
sync_state: clean
type: item_state
---
