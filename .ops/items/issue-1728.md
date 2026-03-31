---
id: issue-1728
provider: github
kind: issue
key: callumalpass/tasknotes#1728
external_ref: https://github.com/callumalpass/tasknotes/issues/1728
repo: callumalpass/tasknotes
number: 1728
remote_state: open
remote_title: "[Bug]: Tasks created from within a Project note are not automatically assigned to that Project (even with parent toggle enabled)"
remote_author: "greatEmily"
remote_url: https://github.com/callumalpass/tasknotes/issues/1728
local_status: triaged
priority: high
difficulty: medium
risk: medium
summary: "useParentNoteAsProject toggle only applies to one task creation path (inline), not the main command palette / toolbar flow"
notes: |
  ## Root cause / Scope
  In `src/main.ts`, the `useParentNoteAsProject` setting is applied inside the inline creation code path (around line 1634), where a `prePopulatedValues.projects` array is built before opening `TaskCreationModal`. However, the primary `openTaskCreationModal()` helper (line 1116) does not perform this lookup — it opens the modal with no pre-populated project. When the user triggers task creation via the command palette or a toolbar button, `openTaskCreationModal()` is called unconditionally without inspecting the setting or the active file, so the project field remains empty.

  ## Suggested fix / Approach
  Move (or duplicate) the `useParentNoteAsProject` logic into `openTaskCreationModal()` so all creation entry-points respect it. The method should read `this.app.workspace.getActiveFile()`, check the setting, generate the markdown link, and merge it into `prePopulatedValues.projects` before opening the modal.
command_id: triage-issue
last_analyzed_at: "2026-03-31"
sync_state: clean
type: item_state
---
