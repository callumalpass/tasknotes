---
id: issue-1625
provider: github
kind: issue
key: callumalpass/tasknotes#1625
external_ref: https://github.com/callumalpass/tasknotes/issues/1625
repo: callumalpass/tasknotes
number: 1625
remote_state: open
remote_title: "[FR]: Multiple task creation in modal"
remote_author: "tcb678"
remote_url: https://github.com/callumalpass/tasknotes/issues/1625
local_status: triaged
priority: low
difficulty: medium
risk: low
summary: "FR: add a 'Save and create another' keyboard shortcut in the task creation modal to speed up bulk task entry"
notes: |
  ## Root cause / Scope
  The task creation modal currently closes and does not reopen after saving. There is no "Save and create another" action. Users must re-trigger the modal via command palette or button for each new task, which is slow for bulk entry. The alternative (list conversion) requires a throw-away scratch note.

  ## Suggested fix / Approach
  Add a secondary submit action to `TaskCreationModal.ts` — either a button ("Save & create another") or a keyboard shortcut (e.g., Shift+Enter or Shift+Cmd+Enter) that calls the save logic and then resets the modal state (clearing title, dates, etc.) while keeping it open. Preserve context-specific defaults (project, tags) optionally via a "keep context" toggle.
command_id: triage-issue
last_analyzed_at: "2026-03-31"
sync_state: clean
type: item_state
---
