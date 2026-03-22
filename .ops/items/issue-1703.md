---
id: 'github:callumalpass/tasknotes:issue:1703'
provider: github
kind: issue
key: '1703'
external_ref: callumalpass/tasknotes#1703
repo: callumalpass/tasknotes
number: 1703
remote_state: OPEN
remote_title: >-
  [FR]: Trigger clear scheduled date when change status to in-progress
remote_author: kmaustral
remote_url: 'https://github.com/callumalpass/tasknotes/issues/1703'
local_status: triaged
priority: low
difficulty: easy
risk: low
summary: >-
  Feature request to automatically clear the scheduled date when a task status
  changes to in-progress. Related to the broader request in issue #1699 for
  automatic date assignment on status change.
notes: |-
  Root cause:
  - Not a bug. Currently only the completion status transition has automatic date behavior (setting completedDate). No other status transitions trigger date field changes.

  Suggested fix (preferred):
  - Implement as part of the status-to-date-property mapping proposed in #1699, where each status config can optionally specify date fields to set or clear.
  - For a quick standalone fix: add a hook in TaskService.updateTaskStatus() that clears the scheduled date when status changes to any in-progress status.

  Fallback options:
  - Add a dedicated setting "Clear scheduled date on in-progress" in the features settings tab.
  - Implement via TriggerConfigService as a user-configurable automation rule.
command_id: triage-issue
last_analyzed_at: '2026-03-22T00:00:00Z'
sync_state: clean
type: item_state
---
