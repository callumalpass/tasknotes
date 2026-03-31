---
id: issue-1710
provider: github
kind: issue
key: callumalpass/tasknotes#1710
external_ref: https://github.com/callumalpass/tasknotes/issues/1710
repo: callumalpass/tasknotes
number: 1710
remote_state: open
remote_title: "[Bug]: Subtask doesn't automatically inherit project"
remote_author: "Jalpara"
remote_url: https://github.com/callumalpass/tasknotes/issues/1710
local_status: triaged
priority: medium
difficulty: easy
risk: low
summary: "When creating a subtask via the context menu from within a project, the new task's project field is not pre-populated with the parent project"
notes: |
  ## Root cause / Scope
  In src/components/TaskContextMenu.ts the "Create subtask" menu item calls plugin.openTaskCreationModal({ projects: [projectReference] }) where projectReference is a wikilink pointing to the *current task* file — not to the project the current task belongs to. So the new task is linked as a subtask of the parent task (correct), but it does not inherit the parent task's own project membership. If a user is working inside a named project (e.g., "YGPT Dashboard") and creates a subtask of a task in that project, the subtask is created without the project field set, causing it to not appear in the Kanban board for that project.

  ## Suggested fix / Approach
  When building the prePopulatedValues for openTaskCreationModal in the "Create subtask" handler, also forward the parent task's `projects` array so the new subtask inherits the same project(s). The fix is localised to the single onClick handler at ~line 671 of src/components/TaskContextMenu.ts.
command_id: triage-issue
last_analyzed_at: "2026-03-31"
sync_state: clean
type: item_state
---
