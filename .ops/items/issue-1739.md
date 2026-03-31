---
id: issue-1739
provider: github
kind: issue
key: callumalpass/tasknotes#1739
external_ref: https://github.com/callumalpass/tasknotes/issues/1739
repo: callumalpass/tasknotes
number: 1739
remote_state: open
remote_title: "[Bug]: Moving cards between status in kanban view"
remote_author: "mgsima"
remote_url: https://github.com/callumalpass/tasknotes/issues/1739
local_status: triaged
priority: high
difficulty: hard
risk: high
summary: "Kanban drag-and-drop stops responding after initial moves; cards snap back or drop zones stop registering, requiring a full page refresh"
notes: |
  ## Root cause / Scope
  `KanbanView.ts` has a complex drag-state lifecycle: `draggedTaskPath`, `activeDropCount`, `suppressRenderUntil`, and `postDropTimer` must all reset cleanly after every drop. If any of these counters gets out of sync (e.g. a `dragend` fires before the async `handleTaskDrop` completes, or an exception inside `handleTaskDrop` prevents `activeDropCount` from decrementing), subsequent drag operations find a non-null `draggedTaskPath` or a non-zero `activeDropCount`, causing `onDataUpdated` to suppress re-renders indefinitely. The `pendingRender` flag compounds this — if it is set but never cleared it will block future renders even after the drag ends.

  ## Suggested fix / Approach
  Add a guaranteed cleanup path: wrap the entire `handleTaskDrop` async flow in try/finally and always decrement `activeDropCount` and reset `draggedTaskPath` in the finally block. Also ensure `pendingRender` is checked and cleared whenever `draggedTaskPath` transitions to null. Consider adding a watchdog timeout that force-resets all drag state after ~5 seconds to recover from any missed cleanup.
command_id: triage-issue
last_analyzed_at: "2026-03-31"
sync_state: clean
type: item_state
---
