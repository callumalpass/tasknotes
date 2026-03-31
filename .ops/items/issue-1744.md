---
id: issue-1744
provider: github
kind: issue
key: callumalpass/tasknotes#1744
external_ref: https://github.com/callumalpass/tasknotes/issues/1744
repo: callumalpass/tasknotes
number: 1744
remote_state: open
remote_title: "[Bug]: Practical issues with applying filters to nested tasks: The `Expanded relationship` option does not work"
remote_author: "minol-dev"
remote_url: https://github.com/callumalpass/tasknotes/issues/1744
local_status: triaged
priority: medium
difficulty: medium
risk: medium
summary: "The 'Expanded relationship: show-all' option does not bypass the Bases filter for subtasks, so child tasks are hidden when a parent-only filter is active"
notes: |
  ## Root cause / Scope
  In `src/ui/TaskCard.ts`, `filterExpandedRelationshipTasks()` checks `options.expandedRelationshipFilterMode !== "inherit"` and returns all tasks unfiltered when mode is `"show-all"`. The filtering logic itself appears correct. However, `currentVisibleTaskPaths` in `TaskListView` and `KanbanView` is populated from the Bases query result — which already excludes subtasks that don't satisfy the filter (e.g. `note.projects.isEmpty()==false`). So by the time `filterExpandedRelationshipTasks` runs, the subtasks are not even in `tasks` array passed to the card's expanded-relationship renderer. The `show-all` mode can only show tasks already fetched; it cannot re-include tasks that Bases discarded.

  ## Suggested fix / Approach
  When `expandedRelationshipFilterMode === "show-all"`, the subtask data must be fetched independently outside the Bases result set (e.g. by querying `cacheManager.getAllTasks()` and filtering by parent reference). The view should augment its task set with these additional subtasks before rendering expanded relationships, bypassing the Bases filter entirely for child tasks. This requires a two-pass data fetch in `TaskListView` and `KanbanView` when the mode is `show-all`.
command_id: triage-issue
last_analyzed_at: "2026-03-31"
sync_state: clean
type: item_state
---
