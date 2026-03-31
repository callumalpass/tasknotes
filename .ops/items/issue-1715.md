---
id: issue-1715
provider: github
kind: issue
key: callumalpass/tasknotes#1715
external_ref: https://github.com/callumalpass/tasknotes/issues/1715
repo: callumalpass/tasknotes
number: 1715
remote_state: open
remote_title: "[FR]: Hide subtasks when they're folded under Main Task"
remote_author: "hokfujow"
remote_url: https://github.com/callumalpass/tasknotes/issues/1715
local_status: triaged
priority: low
difficulty: medium
risk: low
summary: "Feature request to suppress subtasks from appearing as standalone list items when they are already shown folded beneath their parent task"
notes: |
  ## Root cause / Scope
  When the "fold subtasks under parent" feature is enabled, subtasks still appear as independent top-level rows in the list view alongside their folded representation under the parent. Users want an option to deduplicate — show subtasks only under the parent when folded, not as separate rows.

  ## Suggested fix / Approach
  Add a setting (e.g. "Hide subtasks that are displayed under a parent task") that, when enabled, filters out tasks from the flat list if they are currently rendered as children of an expanded parent card in the same view. In src/bases/TaskListView.ts the "filter-project-subtasks" logic already exists; extend it or add a complementary post-render filter pass that removes task cards whose path is already present as a nested subtask element in the DOM (the check at line 653 for parentTaskCard ancestry is a related pattern to build on).
command_id: triage-issue
last_analyzed_at: "2026-03-31"
sync_state: clean
type: item_state
---
