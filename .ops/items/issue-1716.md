---
id: 'github:callumalpass/tasknotes:issue:1716'
provider: github
kind: issue
key: '1716'
external_ref: callumalpass/tasknotes#1716
repo: callumalpass/tasknotes
number: 1716
remote_state: OPEN
remote_title: >-
  [FR]: Improve behavior of subtasks
remote_author: hokfujow
remote_url: 'https://github.com/callumalpass/tasknotes/issues/1716'
local_status: triaged
priority: medium
difficulty: hard
risk: medium
summary: >-
  Feature request to improve subtask UX in modals/widgets: show subtask properties inline,
  allow editing from the parent modal, or navigate into subtask detail replacing the parent view.
notes: |-
  Root cause:
  - Not a bug. The current subtask display in the Task Modal (TaskModal.ts) and Task Card shows
    subtask names as simple links. Clicking opens the subtask file in a background tab behind the
    modal. There is no inline property display or in-modal editing for subtasks.

  Suggested fix (preferred):
  - Option 1: Render subtask items in the modal/widget with compact property badges (status,
    priority, due date) similar to how task cards show properties. Add right-click context menu
    support on subtask rows to allow quick property changes.
  - Option 2: Implement drill-down navigation where clicking a subtask replaces the modal content
    with the subtask's details, with a breadcrumb/back button to return to the parent.

  Fallback options:
  - At minimum, change the click behavior so that clicking a subtask in a modal closes the modal
    and opens the subtask file in the foreground, making the current behavior less confusing.
command_id: triage-issue
last_analyzed_at: '2026-03-26T00:03:00Z'
sync_state: clean
type: item_state
---
