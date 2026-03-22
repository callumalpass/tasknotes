---
id: 'github:callumalpass/tasknotes:issue:1625'
provider: github
kind: issue
key: '1625'
external_ref: callumalpass/tasknotes#1625
repo: callumalpass/tasknotes
number: 1625
remote_state: OPEN
remote_title: >-
  [FR]: Multiple task creation in modal
remote_author: tcb678
remote_url: 'https://github.com/callumalpass/tasknotes/issues/1625'
local_status: triaged
priority: low
difficulty: easy
risk: low
summary: >-
  Feature request to allow creating multiple tasks in quick succession from the
  Create Task modal, e.g., via a Shift-Cmd-Enter shortcut that saves the
  current task and immediately reopens the modal for the next one.
notes: |-
  Root cause:
  - Not a bug. The current modal closes after each task creation. There is
    no "create and continue" workflow.

  Suggested fix (preferred):
  - Add a "Create Another" button or Shift+Enter hotkey to the
    TaskCreationModal that, after successfully creating the task, resets
    the form fields and keeps the modal open for the next entry.
  - In src/modals/TaskCreationModal.ts, after the createTask() call
    succeeds, instead of calling this.close(), reset form fields and
    refocus the title input.

  Fallback options:
  - Add a setting/toggle in the modal to "Keep open after creation" that
    users can enable when doing batch entry.
command_id: triage-issue
last_analyzed_at: '2026-03-22T00:00:00Z'
sync_state: clean
type: item_state
---
