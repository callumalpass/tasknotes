---
id: issue-1666
provider: github
kind: issue
key: callumalpass/tasknotes#1666
external_ref: https://github.com/callumalpass/tasknotes/issues/1666
repo: callumalpass/tasknotes
number: 1666
remote_state: open
remote_title: "[FR]: Display dropdown for tasks within note"
remote_author: "imsuck"
remote_url: https://github.com/callumalpass/tasknotes/issues/1666
local_status: triaged
priority: low
difficulty: medium
risk: low
summary: "FR: Show inline markdown checkbox tasks from a note as a collapsible dropdown list"
notes: |
  ## Root cause / Scope
  TaskNotes currently shows a progress bar for inline markdown checkboxes within a task note but does not display them as an interactive collapsible list. Users want to see and manage these lightweight inline tasks without navigating to the note, reducing friction for simple sub-task workflows.

  ## Suggested fix / Approach
  Extend the task card or task detail view to parse and render inline `- [ ]` / `- [x]` items from the note body as a collapsible list similar to the existing subtask chevron UI. Would require reading note body content, parsing checkbox lines, and rendering them with toggle capability (writing back to the file on check/uncheck). Scope includes the `TaskCard` component and potentially a new inline-tasks renderer. Medium difficulty due to the file-write-back loop and UI state management.
command_id: triage-issue
last_analyzed_at: "2026-03-31"
sync_state: clean
type: item_state
---
