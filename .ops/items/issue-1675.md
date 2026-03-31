---
id: issue-1675
provider: github
kind: issue
key: callumalpass/tasknotes#1675
external_ref: https://github.com/callumalpass/tasknotes/issues/1675
repo: callumalpass/tasknotes
number: 1675
remote_state: open
remote_title: "[FR]: Vertical Kanban View"
remote_author: "bachrc"
remote_url: https://github.com/callumalpass/tasknotes/issues/1675
local_status: triaged
priority: low
difficulty: medium
risk: low
summary: "FR: Add a vertical (single-column stacked) layout option for the Kanban view"
notes: |
  ## Root cause / Scope
  The Kanban view (`src/bases/KanbanView.ts`) always renders columns horizontally side-by-side using a flex-row layout. Users who dock the Kanban in a narrow sidebar want a vertical stacking mode where columns flow top-to-bottom instead of left-to-right. The reporter notes this accidentally worked at some point, suggesting it may be achievable via CSS flex-direction change.

  ## Suggested fix / Approach
  Add a `kanbanLayout` option (`horizontal` | `vertical`) to the Kanban view configuration (registered in `src/bases/registration.ts`). When `vertical` is selected, apply a CSS class that switches the board container's `flex-direction` to `column` and makes columns full-width. This is primarily a CSS/layout change with a small settings registration addition. Medium difficulty due to needing to ensure column widths, drag-and-drop, and auto-scroll all still work correctly in the vertical layout.
command_id: triage-issue
last_analyzed_at: "2026-03-31"
sync_state: clean
type: item_state
---
