---
id: issue-1682
provider: github
kind: issue
key: callumalpass/tasknotes#1682
external_ref: https://github.com/callumalpass/tasknotes/issues/1682
repo: callumalpass/tasknotes
number: 1682
remote_state: open
remote_title: "[FR]: Subtask List in TaskList View should respect filter settings"
remote_author: "Glint-Eye"
remote_url: https://github.com/callumalpass/tasknotes/issues/1682
local_status: triaged
priority: low
difficulty: medium
risk: low
summary: "FR: Expanded subtask chevron should apply the parent view's filter (e.g. hide completed) to shown subtasks"
notes: |
  ## Root cause / Scope
  In `src/ui/TaskCard.ts`, `filterExpandedRelationshipTasks()` (line 78) only filters the subtask list when `expandedRelationshipFilterMode === "inherit"` AND `expandedRelationshipTaskPaths` is provided. By default (`DEFAULT_TASK_CARD_OPTIONS`), neither is set, so all subtasks are shown unconditionally when the user clicks the chevron, bypassing the view's active filter (e.g. a filter that hides completed tasks). Parent tasks respect the filter correctly; only the expanded inline subtask list does not.

  ## Suggested fix / Approach
  When rendering subtask cards in the chevron-expanded section, pass the current view's filter query as `expandedRelationshipFilterMode: "inherit"` and `expandedRelationshipTaskPaths` populated by running the view's filter against the candidate subtasks. The infrastructure (`filterExpandedRelationshipTasks`) is already in place—the gap is that the `TaskListView` (and `KanbanView`) don't pass the filtered task path set down through `TaskCardOptions` when creating cards. Medium difficulty as it requires threading the active filter result set through the card-creation call sites.
command_id: triage-issue
last_analyzed_at: "2026-03-31"
sync_state: clean
type: item_state
---
