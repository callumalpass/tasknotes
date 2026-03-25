---
id: 'github:callumalpass/tasknotes:issue:1717'
provider: github
kind: issue
key: '1717'
external_ref: callumalpass/tasknotes#1717
repo: callumalpass/tasknotes
number: 1717
remote_state: OPEN
remote_title: >-
  [Bug] Archived Subtasks Not Hidden in Task Card or Relationships Widget
remote_author: prepare4robots
remote_url: 'https://github.com/callumalpass/tasknotes/issues/1717'
local_status: triaged
priority: medium
difficulty: medium
risk: low
summary: >-
  Subtasks with archived status/tags/folder location continue to appear in the Task Card and
  Relationships Widget because view-level filters are not applied to subtask rendering.
notes: |-
  Root cause:
  - In src/ui/TaskCard.ts toggleSubtasks() (lines 2471-2528), subtasks are fetched via
    projectSubtasksService.getTasksLinkedToProject() and rendered without applying any filters.
    Lines 2473-2476 contain an explicit comment acknowledging this: "Apply current filter to
    subtasks if available / For now, we'll show all subtasks to keep the implementation simple."
  - The Relationships Widget likely has the same issue - filters apply at the top-level query
    but subtask relationships are resolved separately without filter evaluation.

  Suggested fix (preferred):
  - After fetching subtasks in toggleSubtasks(), filter out archived tasks by checking
    task.archived flag, status matching the configured archive status, or path containing the
    archive folder. This covers the most common case without needing full filter propagation.
  - For the Relationships Widget, apply the same archived-task exclusion logic.

  Fallback options:
  - Expose a setting "Hide archived subtasks" (default: true) that applies a simple archived
    check in toggleSubtasks() without requiring full filter node evaluation.
  - Full filter propagation to subtasks (as requested in issue 1725) would also resolve this
    but is a larger scope change.
command_id: triage-issue
last_analyzed_at: '2026-03-26T00:03:00Z'
sync_state: clean
type: item_state
---
