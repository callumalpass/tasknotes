---
id: 'github:callumalpass/tasknotes:issue:1728'
provider: github
kind: issue
key: '1728'
external_ref: callumalpass/tasknotes#1728
repo: callumalpass/tasknotes
number: 1728
remote_state: OPEN
remote_title: >-
  [Bug]: Tasks created from within a Project note are not automatically assigned to that Project (even with parent toggle enabled)
remote_author: greatEmily
remote_url: 'https://github.com/callumalpass/tasknotes/issues/1728'
local_status: triaged
priority: high
difficulty: easy
risk: low
summary: >-
  The useParentNoteAsProject setting only takes effect in the inline task creation path
  (createInlineTask). The main openTaskCreationModal method, used by the command palette
  and ribbon icon, does not check this setting or pass the parent note as a pre-populated
  project.
notes: |-
  Root cause:
  - The createInlineTask method (main.ts line 2970) correctly checks
    settings.taskCreationDefaults.useParentNoteAsProject, gets the active file, generates
    a markdown link, and passes it as prePopulatedValues.projects to TaskCreationModal.
  - However, openTaskCreationModal (main.ts line 2324) simply creates a new TaskCreationModal
    with whatever prePopulatedValues are passed (often undefined). It does NOT check
    useParentNoteAsProject.
  - The command palette "Create new task" command (line 1570) calls openTaskCreationModal()
    with no arguments, so the parent note is never injected.
  - The InstantTaskConvertService (line 617) also handles this setting correctly for inline
    conversions, confirming the pattern was only omitted from the modal creation path.

  Suggested fix (preferred):
  - In openTaskCreationModal (main.ts line 2324), add the same useParentNoteAsProject check
    that exists in createInlineTask: if enabled, get the active file, generate a markdown
    link, and merge it into prePopulatedValues.projects before passing to TaskCreationModal.
  - This is a ~10 line change in a single method.

  Fallback options:
  - Move the useParentNoteAsProject logic into TaskCreationModal.initializeDefaults() so
    it always checks the setting regardless of how the modal is opened. This would be more
    robust but touches the modal class.
command_id: triage-issue
last_analyzed_at: '2026-03-29T00:00:00Z'
sync_state: clean
type: item_state
---
