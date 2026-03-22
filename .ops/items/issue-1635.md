---
id: 'github:callumalpass/tasknotes:issue:1635'
provider: github
kind: issue
key: '1635'
external_ref: callumalpass/tasknotes#1635
repo: callumalpass/tasknotes
number: 1635
remote_state: OPEN
remote_title: >-
  [FR]: Track number of changes to due/scheduled
remote_author: stil-sudo
remote_url: 'https://github.com/callumalpass/tasknotes/issues/1635'
local_status: triaged
priority: low
difficulty: medium
risk: low
summary: >-
  Feature request to track how many times the due or scheduled date of a task
  has been changed. This would help users identify tasks that are repeatedly
  rescheduled and may be at risk of neglect.
notes: |-
  Root cause:
  - There is no audit trail for property changes. When `TaskService` updates a due or scheduled date, the old value is simply overwritten in frontmatter with no history.

  Suggested fix (preferred):
  - Add optional `dueChangeCount` and `scheduledChangeCount` (or a combined `rescheduleCount`) frontmatter property that is incremented each time `TaskService` updates the corresponding date field.
  - Expose this counter as a display-only property on task cards and make it available for filtering/sorting in bases views.

  Fallback options:
  - Maintain a `dateHistory` list property that logs each change with timestamp and old/new values, providing full audit trail rather than just a count.
  - Implement this as a plugin-level metric stored outside the task frontmatter (e.g., in plugin data) to avoid cluttering task notes.
command_id: triage-issue
last_analyzed_at: '2026-03-22T00:00:00Z'
sync_state: clean
type: item_state
---
