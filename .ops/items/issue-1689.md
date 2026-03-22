---
id: 'github:callumalpass/tasknotes:issue:1689'
provider: github
kind: issue
key: '1689'
external_ref: callumalpass/tasknotes#1689
repo: callumalpass/tasknotes
number: 1689
remote_state: OPEN
remote_title: >-
  [Bug]: Bug / Feature Request: Reminders not triggered when created via file edit & don't recalculate on schedule changes
remote_author: garzonjav
remote_url: 'https://github.com/callumalpass/tasknotes/issues/1689'
local_status: triaged
priority: medium
difficulty: medium
risk: medium
summary: >-
  Reminders written directly to YAML frontmatter are never registered with the
  in-memory notification scheduler, and relative reminders do not recalculate
  when the related date property changes.
notes: |-
  Root cause:
  - Issue 1 (file-edit reminders): NotificationService.scanTasksAndBuildQueue()
    (line 107) runs on a 5-minute broad scan interval and reads reminders from
    the task cache. However, the processedReminders set (line 18) prevents
    re-processing. If a reminder was previously scanned with no valid notifyAt
    (because the task didn't exist yet or the reminder was added after the
    scan window), it may never be queued. Additionally, reminders added between
    scan intervals won't be picked up until the next broad scan.
  - Issue 2 (no recalculation): calculateNotificationTime() (line 148)
    computes the notification time from the current task.scheduled/task.due
    at scan time, but once a reminder is added to processedReminders, it won't
    be re-evaluated even if the anchor date changes. The processedReminders
    set uses a simple path+id key that persists across scans.
  - Issue 3 (no visual indicator): The reminder data model has no
    active/registered field to distinguish scheduled vs unscheduled reminders.

  Suggested fix (preferred):
  - Listen for the EVENT_TASK_UPDATED event (already imported in
    NotificationService) and re-scan affected tasks when their scheduled/due
    dates or reminders change. Clear the processedReminders entry for the
    updated task so it gets re-evaluated.
  - On file change detection (vault 'modify' event or metadata cache update),
    trigger a targeted re-scan for the changed file's reminders.

  Fallback options:
  - Reduce the broad scan interval or add a file-change triggered scan.
  - Add a manual "refresh reminders" command.
command_id: triage-issue
last_analyzed_at: '2026-03-22T00:00:00Z'
sync_state: clean
type: item_state
---
