---
id: 'github:callumalpass/tasknotes:issue:1711'
provider: github
kind: issue
key: '1711'
external_ref: callumalpass/tasknotes#1711
repo: callumalpass/tasknotes
number: 1711
remote_state: OPEN
remote_title: >-
  [Bug]: Cannot select end time of task
remote_author: Jalpara
remote_url: 'https://github.com/callumalpass/tasknotes/issues/1711'
local_status: triaged
priority: medium
difficulty: medium
risk: low
summary: >-
  The task edit modal does not provide a way to set or edit the end time of a task.
  Only the start/scheduled time can be set. The end_time field is available in
  timeblock creation modals but not in the main task editing flow.
notes: |-
  Root cause:
  - The TaskEditModal (src/modals/TaskEditModal.ts) does not include an end_time input field. End time is only available in TimeblockCreationModal and TimeEntryEditorModal.
  - Tasks have a time estimate (duration) concept rather than an explicit end_time property, but some users expect to set a concrete end time.
  - The task type definition (src/types.ts) may not have an explicit end_time field on TaskInfo.

  Suggested fix (preferred):
  - Add an end_time field to the task edit modal, alongside the existing scheduled time picker. When set, compute and store it as either a separate frontmatter property or derive the time estimate from start-end difference.
  - Alternatively, if the task already has a due date+time concept, ensure the due time picker is accessible and clearly labeled as the end time.

  Fallback options:
  - Expose the time estimate field more prominently and auto-calculate end time from scheduled time + estimate for display purposes.
  - Document that end time is implicitly scheduled_time + time_estimate.
command_id: triage-issue
last_analyzed_at: '2026-03-22T00:00:00Z'
sync_state: clean
type: item_state
---
