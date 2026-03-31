---
id: issue-1716
provider: github
kind: issue
key: callumalpass/tasknotes#1716
external_ref: https://github.com/callumalpass/tasknotes/issues/1716
repo: callumalpass/tasknotes
number: 1716
remote_state: open
remote_title: "[FR]: Improve behavior of subtasks"
remote_author: "hokfujow"
remote_url: https://github.com/callumalpass/tasknotes/issues/1716
local_status: triaged
priority: low
difficulty: medium
risk: low
summary: "Feature request to display subtask metadata and allow editing within the parent task's modal/widget, and improve navigation between parent and subtask"
notes: |
  ## Root cause / Scope
  When viewing a parent task's widget, subtasks listed within it show only a title with no status, priority, or date information, and right-clicking does nothing. Clicking a subtask opens the file in a background tab behind the modal. The reporter wants either full property editing within the widget, or navigation that replaces the current modal view with the subtask view with a breadcrumb back to the parent.

  ## Suggested fix / Approach
  Option 1: Render subtask rows in the parent task modal (src/modals/TaskModal.ts, createSubtasksField) as mini task cards using the existing createTaskCard() infrastructure so they display status/priority/dates and support right-click context menus. Option 2: Change the click handler on subtask items in the modal so that it closes the current modal and opens a new TaskModal for the subtask, with a "back" button that reopens the parent. Either approach requires changes to TaskModal.ts and the subtask list rendering path.
command_id: triage-issue
last_analyzed_at: "2026-03-31"
sync_state: clean
type: item_state
---
