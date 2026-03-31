---
id: issue-1668
provider: github
kind: issue
key: callumalpass/tasknotes#1668
external_ref: https://github.com/callumalpass/tasknotes/issues/1668
repo: callumalpass/tasknotes
number: 1668
remote_state: open
remote_title: "[Bug]: NLP trigger not working for additional properties"
remote_author: "hokfujow"
remote_url: https://github.com/callumalpass/tasknotes/issues/1668
local_status: triaged
priority: medium
difficulty: medium
risk: medium
summary: "NLP magic wand button does not populate user-defined custom property fields in the task creation form"
notes: |
  ## Root cause / Scope
  In `src/modals/TaskCreationModal.ts`, `applyParsedData()` correctly stores parsed user field values into `this.userFields[userField.key]` (lines 1063–1068), but it never updates the corresponding DOM input elements that were rendered during form initialization. The user field inputs are rendered by `TaskModal.ts` at form build time, and their initial values are read from `this.userFields`, but there is no code path to push new `this.userFields` values back into the already-rendered input elements after the wand button triggers `applyParsedData`. The live form UI therefore shows empty fields even though the data is stored internally.

  The NLP autocomplete does show values next to the property name in the title input (from `NLPCodeMirrorAutocomplete.ts`), confirming the trigger character parsing works; only the wand/form-apply step fails to update the DOM.

  ## Suggested fix / Approach
  After storing values in `this.userFields` within `applyParsedData`, iterate over the rendered user field input elements and set their `.value` property to match the newly stored values. This requires either keeping a map of `fieldKey → HTMLInputElement` references (similar to how `titleInput`, `contextsInput`, etc. are stored) or re-querying the DOM. Medium effort spanning `TaskCreationModal.ts` and the user field rendering in `TaskModal.ts`.
command_id: triage-issue
last_analyzed_at: "2026-03-31"
sync_state: clean
type: item_state
---
