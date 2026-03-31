---
id: issue-1717
provider: github
kind: issue
key: callumalpass/tasknotes#1717
external_ref: https://github.com/callumalpass/tasknotes/issues/1717
repo: callumalpass/tasknotes
number: 1717
remote_state: open
remote_title: "[Bug] Archived Subtasks Not Hidden in Task Card or Relationships Widget"
remote_author: "prepare4robots"
remote_url: https://github.com/callumalpass/tasknotes/issues/1717
local_status: triaged
priority: medium
difficulty: medium
risk: medium
summary: "Archived subtasks continue to appear in the Task Card and Relationships Widget even when archive filters are applied at the root level"
notes: |
  ## Root cause / Scope
  Filters applied in the Relationships/Bases widget successfully exclude top-level archived tasks, but the same filters are not applied when resolving the subtask list for a given parent task. In src/ui/TaskCard.ts the toggleSubtasks function fetches subtasks via plugin.projectSubtasksService; if that service retrieves the full subtask list without re-applying the active Bases filter, archived subtasks will slip through regardless of filter configuration. The task card's subtask expansion code (around line 2338) does sort subtasks but there is no evidence of an archive-status filter being applied in that path. Similarly, the Relationships widget renders a Bases embed (src/editor/RelationshipsDecorations.ts, createRelationshipsWidget) which should inherit Bases filters, but the subtask relationship data passed as context may bypass filter evaluation.

  ## Suggested fix / Approach
  In the subtask fetch path used by toggleSubtasks (src/ui/TaskCard.ts), explicitly filter out tasks whose `archived` property is truthy, matching the pattern used in other services (e.g., TaskActionCoordinator.ts line 76: .filter(task => !task.archived)). For the Relationships widget path, ensure the Bases embed context evaluates the configured filter expression against subtask records the same way it does for root-level records.
command_id: triage-issue
last_analyzed_at: "2026-03-31"
sync_state: clean
type: item_state
---
