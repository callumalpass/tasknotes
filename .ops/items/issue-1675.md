---
id: 'github:callumalpass/tasknotes:issue:1675'
provider: github
kind: issue
key: '1675'
external_ref: callumalpass/tasknotes#1675
repo: callumalpass/tasknotes
number: 1675
remote_state: OPEN
remote_title: >-
  [FR]: Vertical Kanban View
remote_author: bachrc
remote_url: 'https://github.com/callumalpass/tasknotes/issues/1675'
local_status: triaged
priority: low
difficulty: medium
risk: low
summary: >-
  Feature request for a vertical (single-column, top-to-bottom) Kanban layout option, useful when
  the board is displayed in a narrow sidebar.
notes: |-
  Root cause:
  - Not a bug. The Kanban view currently only renders columns left-to-right in a horizontal flex layout
    (src/bases/KanbanView.ts, styles/kanban-view.css). There is no layout toggle for vertical stacking.

  Suggested fix (preferred):
  - Add a "layout" view option (horizontal | vertical) to KanbanView. In vertical mode, change
    .kanban-board flex-direction from row to column and adjust column widths to 100%. Wire the
    option into BasesViewConfig so users can toggle per-view.

  Fallback options:
  - Provide a CSS snippet users can add manually that converts the board to vertical layout
    via `flex-direction: column` on `.kanban-board`.
command_id: triage-issue
last_analyzed_at: '2026-03-22T00:00:00Z'
sync_state: clean
type: item_state
---
