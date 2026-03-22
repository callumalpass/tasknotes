---
id: 'github:callumalpass/tasknotes:issue:1701'
provider: github
kind: issue
key: '1701'
external_ref: callumalpass/tasknotes#1701
repo: callumalpass/tasknotes
number: 1701
remote_state: OPEN
remote_title: >-
  [Bug]: skipped instances aren't appearing in the skipped instances property
remote_author: Ruboks-Cube
remote_url: 'https://github.com/callumalpass/tasknotes/issues/1701'
local_status: triaged
priority: medium
difficulty: medium
risk: medium
summary: >-
  Recurring tasks that are simply ignored (not completed or explicitly skipped)
  on a given day do not get recorded in the skipped_instances frontmatter property.
  The skip mechanism only fires on explicit user action (context menu skip), not
  automatically when a recurring date passes without interaction.
notes: |-
  Root cause:
  - The skipped_instances array is only populated by explicit user action via TaskService.toggleRecurringTaskSkip() (line ~2065). There is no background process that auto-detects missed/passed recurring instances and records them as skipped.
  - The helpers in src/utils/helpers.ts (line ~761) filter out skipped instances when calculating next occurrence, but never auto-add entries.
  - The user expects that if they don't interact with a recurring task on its scheduled day, it should automatically appear in skipped_instances.

  Suggested fix (preferred):
  - Add a reconciliation step in the recurring task scheduler (possibly in TaskService or as part of the AutoArchiveService cycle) that checks for past un-completed, un-skipped recurring instances and auto-populates skipped_instances.
  - This should run on plugin load and periodically, comparing the RRULE-generated dates against complete_instances and skipped_instances.

  Fallback options:
  - Document that skipped_instances only tracks explicitly skipped instances; auto-skipping may conflict with users who want overdue instances to remain actionable.
  - Add an optional setting "auto-skip past instances" that users can enable.
command_id: triage-issue
last_analyzed_at: '2026-03-22T00:00:00Z'
sync_state: clean
type: item_state
---
