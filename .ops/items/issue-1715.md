---
id: 'github:callumalpass/tasknotes:issue:1715'
provider: github
kind: issue
key: '1715'
external_ref: callumalpass/tasknotes#1715
repo: callumalpass/tasknotes
number: 1715
remote_state: OPEN
remote_title: >-
  [FR]: Hide subtasks when they're folded under Main Task
remote_author: hokfujow
remote_url: 'https://github.com/callumalpass/tasknotes/issues/1715'
local_status: triaged
priority: medium
difficulty: medium
risk: medium
summary: >-
  When subtasks are shown folded under their parent task in a list view, they also appear as
  independent top-level items. Users want an option to deduplicate by hiding subtasks that are
  already visible under their parent.
notes: |-
  Root cause:
  - Not a bug per se, but a missing deduplication feature. The Bases query returns all tasks
    matching the filter, including subtasks. When a parent task is expanded to show its subtasks
    inline, those same subtasks also appear as standalone entries in the list because
    identifyTaskNotesFromBasesData() does not exclude tasks that are subtasks of other visible
    tasks.

  Suggested fix (preferred):
  - Add a view option "Hide nested subtasks from top-level list" (default: false for backward
    compatibility). When enabled, after resolving the task list, identify tasks that are subtasks
    of other tasks in the list (via project/parent references) and exclude them from top-level
    rendering. They would only appear under their parent when expanded.
  - This filtering should happen in the Bases view rendering layer (TaskListView/KanbanView)
    after task identification but before rendering.

  Fallback options:
  - Add CSS-based hiding that uses a class on subtask cards when they are children of an
    expanded parent, though this would not reduce the rendered DOM count.
command_id: triage-issue
last_analyzed_at: '2026-03-26T00:03:00Z'
sync_state: clean
type: item_state
---
