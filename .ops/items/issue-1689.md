---
id: issue-1689
provider: github
kind: issue
key: callumalpass/tasknotes#1689
external_ref: https://github.com/callumalpass/tasknotes/issues/1689
repo: callumalpass/tasknotes
number: 1689
remote_state: open
remote_title: "[Bug]: Bug / Feature Request: Reminders not triggered when created via file edit & don't recalculate on schedule changes"
remote_author: "garzonjav"
remote_url: https://github.com/callumalpass/tasknotes/issues/1689
local_status: triaged
priority: high
difficulty: medium
risk: medium
summary: "Reminders added by direct YAML file editing are never registered as active timers and do not fire"
notes: |
  ## Root cause / Scope
  The `NotificationService` uses two mechanisms to schedule reminders: a periodic broad scan
  (`scanTasksAndBuildQueue` every 5 minutes) and a `setupTaskUpdateListener` that reacts to
  `EVENT_TASK_UPDATED`. The periodic scan reads all tasks from the cache, so reminders written
  directly to YAML frontmatter should be picked up within 5 minutes of the next scan cycle —
  provided the cache is current. The real issue is that reminders with past notification times
  may be added to `processedReminders` by the time the first scan runs after the file is opened,
  or the scan window (`QUEUE_WINDOW = 5 min`) may miss reminders that are further in the future
  if the broad scan never clears `processedReminders` for tasks updated externally. Additionally,
  `EVENT_TASK_UPDATED` is only emitted when tasks are modified through the TaskNotes UI, not via
  vault file-change events, so external edits bypass the immediate re-scan path entirely.

  ## Suggested fix / Approach
  Listen to the Obsidian `vault.on('modify', ...)` or `metadataCache.on('changed', ...)` event for
  task files, and trigger a `clearProcessedRemindersForTask` + partial re-scan when reminders in
  the updated file differ from the cached version. Alternatively, ensure the broad scan fully
  re-reads reminders for all modified files by clearing their processed state on cache invalidation.
  The notification scan window should also be extended or the scan should cover the entire future
  range, not just the next 5 minutes.
command_id: triage-issue
last_analyzed_at: "2026-03-31"
sync_state: clean
type: item_state
---
