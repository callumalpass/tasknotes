---
id: 'github:callumalpass/tasknotes:issue:1710'
provider: github
kind: issue
key: '1710'
external_ref: callumalpass/tasknotes#1710
repo: callumalpass/tasknotes
number: 1710
remote_state: OPEN
remote_title: >-
  [Bug]: Subtask doesn't automatically inherit project
remote_author: Jalpara
remote_url: 'https://github.com/callumalpass/tasknotes/issues/1710'
local_status: triaged
priority: medium
difficulty: easy
risk: low
summary: >-
  When creating a new subtask from a Kanban board's project view, the project
  property is not pre-populated with the parent project. The "Create subtask"
  context menu item sets the parent task as the project, but it does not propagate
  the parent task's own project to the new subtask.
notes: |-
  Root cause:
  - In src/components/TaskContextMenu.ts (line ~650), the "Create subtask" action calls openTaskCreationModal with `projects: [projectReference]` where projectReference is a link to the parent task file itself. This correctly sets the parent-child relationship.
  - However, the user expects the parent task's project property to also be inherited by the subtask. If the parent task belongs to project "YGPT Dashboard", the subtask should also have "YGPT Dashboard" as its project (or at minimum, the parent task link which serves the same purpose).
  - The issue is that the parent task file reference is set as the project, but from the Kanban board context, the user sees the board organized by project and expects the board's project to carry through.

  Suggested fix (preferred):
  - When creating a subtask, also inherit the parent task's project property value (if any) in addition to setting the parent task as a project reference. This way the subtask appears under the same project in Kanban views.
  - Modify the context menu handler to read the parent task's project and pass it as a pre-populated value.

  Fallback options:
  - Use the BasesViewBase.createFileForView() frontmatter processor to pass the current Kanban groupBy value as the default project.
command_id: triage-issue
last_analyzed_at: '2026-03-22T00:00:00Z'
sync_state: clean
type: item_state
---
