---
id: 'github:callumalpass/tasknotes:issue:1692'
provider: github
kind: issue
key: '1692'
external_ref: callumalpass/tasknotes#1692
repo: callumalpass/tasknotes
number: 1692
remote_state: OPEN
remote_title: >-
  [FR]: Expanding the all day area
remote_author: Lanalangz
remote_url: 'https://github.com/callumalpass/tasknotes/issues/1692'
local_status: triaged
priority: low
difficulty: medium
risk: low
summary: >-
  Feature request for two calendar view improvements: (1) resizable all-day
  event area to show all tasks without scrolling, and (2) batch move
  capability for overdue or selected tasks.
notes: |-
  Root cause:
  - Not a bug. The all-day area height is controlled by FullCalendar's
    dayMaxEvents / dayMaxEventRows configuration. Batch task operations
    are not currently implemented.

  Suggested fix (preferred):
  - For resizable all-day area: expose FullCalendar's dayMaxEvents option
    in the calendar view settings, or add a "show all" toggle that sets
    dayMaxEvents to false (unlimited).
  - For batch move: implement a multi-select mode in the calendar view
    (e.g., shift+click or checkbox selection) with a "reschedule selected"
    context menu action.

  Fallback options:
  - For all-day area: add CSS customization guidance for users who want
    to override the max-height.
  - For batch move: leverage the existing batch context menu
    (src/components/BatchContextMenu.ts) and extend it to calendar views.
command_id: triage-issue
last_analyzed_at: '2026-03-22T00:00:00Z'
sync_state: clean
type: item_state
---
