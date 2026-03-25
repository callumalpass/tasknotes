---
id: 'github:callumalpass/tasknotes:issue:1725'
provider: github
kind: issue
key: '1725'
external_ref: callumalpass/tasknotes#1725
repo: callumalpass/tasknotes
number: 1725
remote_state: OPEN
remote_title: >-
  [FR]: Filters to apply to subtasks
remote_author: robmcphers0n
remote_url: 'https://github.com/callumalpass/tasknotes/issues/1725'
local_status: triaged
priority: medium
difficulty: medium
risk: medium
summary: >-
  Feature request for Bases view filters to propagate to subtasks, so that filtering by e.g.
  upcoming deadline shows parent tasks with matching subtasks collapsed under them rather than
  a flat list.
notes: |-
  Root cause:
  - Not a bug. The current filter system in Bases views (TaskListView, KanbanView) operates on
    top-level task items only. Subtasks are rendered separately via toggleSubtasks() in TaskCard.ts
    and are not subject to the view-level filter evaluation.

  Suggested fix (preferred):
  - Extend the filter evaluation in BasesViewBase/TaskListView to also check subtasks of each task.
  - When a subtask matches the filter but the parent does not, include the parent task in results
    with a visual indicator that it is shown for context (collapsed heading style).
  - Pass the active filter node to toggleSubtasks() so subtask rendering can highlight or filter
    which subtasks are shown.

  Fallback options:
  - Add a "Show matching subtasks only" toggle in view options that post-filters the subtask list
    after expansion, without changing the top-level task inclusion logic.
command_id: triage-issue
last_analyzed_at: '2026-03-26T00:03:00Z'
sync_state: clean
type: item_state
---
