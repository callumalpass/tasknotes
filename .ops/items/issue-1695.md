---
id: 'github:callumalpass/tasknotes:issue:1695'
provider: github
kind: issue
key: '1695'
external_ref: callumalpass/tasknotes#1695
repo: callumalpass/tasknotes
number: 1695
remote_state: OPEN
remote_title: >-
  [Bug]: Archived tasks can remain on Google Calendar and orphan their event ID
remote_author: martin-forge
remote_url: 'https://github.com/callumalpass/tasknotes/issues/1695'
local_status: triaged
priority: high
difficulty: medium
risk: medium
summary: >-
  Archive-time Google Calendar deletion is fire-and-forget (not awaited), and
  deleteTaskFromCalendar unconditionally removes googleCalendarEventId even
  after real delete failures, leaving orphaned Google Calendar events with no
  local reference for cleanup.
notes: |-
  Root cause:
  - In TaskService.toggleArchive() (lines 1086-1093), the call to
    deleteTaskFromCalendar(updatedTask) is not awaited. The archive operation
    completes and returns updatedTask before the calendar deletion finishes.
  - In TaskCalendarSyncService.deleteTaskFromCalendar() (lines 919-945),
    removeTaskEventId(task.path) is called unconditionally at line 945, even
    when the delete API call threw a non-404/410 error (e.g., network failure,
    rate limit). This clears the local googleCalendarEventId while the remote
    event still exists.

  Suggested fix (preferred):
  - Await the deleteTaskFromCalendar call in toggleArchive(), or at minimum
    capture the promise and handle failure before returning updatedTask.
  - Move removeTaskEventId inside the try block after successful deletion, and
    also call it in the catch block only for 404/410 errors. For other errors,
    preserve the event ID so retry/cleanup is possible.

  Fallback options:
  - Add a background reconciliation job that periodically checks for archived
    tasks that still have googleCalendarEventId and retries deletion.
command_id: triage-issue
last_analyzed_at: '2026-03-22T00:00:00Z'
sync_state: clean
type: item_state
---
