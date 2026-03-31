---
id: issue-1725
provider: github
kind: issue
key: callumalpass/tasknotes#1725
external_ref: https://github.com/callumalpass/tasknotes/issues/1725
repo: callumalpass/tasknotes
number: 1725
remote_state: open
remote_title: "[FR]: Filters to apply to subtasks"
remote_author: "robmcphers0n"
remote_url: https://github.com/callumalpass/tasknotes/issues/1725
local_status: triaged
priority: low
difficulty: hard
risk: medium
summary: "Feature request to allow view filters to also apply to subtasks shown under parent tasks, with optional collapsed heading display for organizational parents"
notes: |
  ## Root cause / Scope
  Currently filters applied in a TaskList or Kanban view operate on the flat task list; when subtasks are expanded under a parent they are fetched independently by toggleSubtasks (src/ui/TaskCard.ts) without re-applying the view's active filter criteria. The user wants subtasks to be filtered by the same rules so that, for example, a "due this week" filter also constrains which subtasks are shown under each parent, rather than showing all subtasks regardless of their dates.

  ## Suggested fix / Approach
  Pass the current active FilterService criteria down into the toggleSubtasks/ProjectSubtasksService path so that the subtask list is filtered before rendering. Optionally, add a per-view setting "Apply filters to subtasks" that controls this behaviour. The collapsed heading display for organizational parents is an additional UI requirement that would need further design work. This is a multi-component change touching FilterService, ProjectSubtasksService, and the TaskCard subtask toggle path.
command_id: triage-issue
last_analyzed_at: "2026-03-31"
sync_state: clean
type: item_state
---
