---
id: 'github:callumalpass/tasknotes:issue:1666'
provider: github
kind: issue
key: '1666'
external_ref: callumalpass/tasknotes#1666
repo: callumalpass/tasknotes
number: 1666
remote_state: OPEN
remote_title: >-
  [FR]: Display dropdown for tasks within note
remote_author: imsuck
remote_url: 'https://github.com/callumalpass/tasknotes/issues/1666'
local_status: triaged
priority: low
difficulty: medium
risk: low
summary: >-
  Feature request to display inline checkbox tasks within a note as a collapsible dropdown list
  (similar to subtask expansion), rather than just showing a progress bar.
notes: |-
  Root cause:
  - Not a bug. The current note-level task display only renders a progress bar for inline tasks.
    There is no expandable task list UI for note-level inline tasks like there is for subtasks.

  Suggested fix (preferred):
  - Reuse the existing subtask expansion/collapse UI pattern (from TaskCard.ts toggleSubtasks)
    to render inline tasks within a note as a collapsible list. Add a toggle icon next to the
    progress bar that expands to show individual task items.

  Fallback options:
  - Show the task list in a tooltip or popover on hover/click of the progress bar.
command_id: triage-issue
last_analyzed_at: '2026-03-22T00:00:00Z'
sync_state: clean
type: item_state
---
