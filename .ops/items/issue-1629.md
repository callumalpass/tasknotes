---
id: 'github:callumalpass/tasknotes:issue:1629'
provider: github
kind: issue
key: '1629'
external_ref: callumalpass/tasknotes#1629
repo: callumalpass/tasknotes
number: 1629
remote_state: OPEN
remote_title: >-
  [Bug]: `blockedBy` field not saved on create task
remote_author: obsilover
remote_url: 'https://github.com/callumalpass/tasknotes/issues/1629'
local_status: triaged
priority: medium
difficulty: easy
risk: low
summary: >-
  The blockedBy field set in the Create Task modal is silently dropped because
  TaskService.createTask() does not copy taskData.blockedBy into the
  completeTaskData object that gets written to frontmatter.
notes: |-
  Root cause:
  - In src/services/TaskService.ts line ~325-346, the completeTaskData object
    built inside createTask() enumerates specific fields (title, status,
    priority, due, scheduled, contexts, projects, timeEstimate, recurrence,
    etc.) but never includes blockedBy from the incoming taskData.
  - The TaskCreationModal.buildTaskData() (line ~1336-1341) correctly sets
    taskData.blockedBy, but this value is never transferred to completeTaskData
    and is therefore lost before mapToFrontmatter() is called.
  - The Edit Task modal works because it uses TaskService.updateTask() which
    has a separate code path that handles blockedBy properly.

  Suggested fix (preferred):
  - Add blockedBy to the completeTaskData object in createTask(), similar to
    how recurrence and other optional fields are handled:
    `blockedBy: taskData.blockedBy || undefined,`

  Fallback options:
  - Alternatively, after createTask() returns, the modal could call
    updateTask() with just the blockedBy field, but this is less clean
    as it requires an extra file write.
command_id: triage-issue
last_analyzed_at: '2026-03-22T00:00:00Z'
sync_state: clean
type: item_state
---
