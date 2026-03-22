---
id: 'github:callumalpass/tasknotes:issue:1699'
provider: github
kind: issue
key: '1699'
external_ref: callumalpass/tasknotes#1699
repo: callumalpass/tasknotes
number: 1699
remote_state: OPEN
remote_title: >-
  [FR]: Automatic Date Assignment on Status Change
remote_author: vanadium23
remote_url: 'https://github.com/callumalpass/tasknotes/issues/1699'
local_status: triaged
priority: low
difficulty: medium
risk: low
summary: >-
  Feature request to automatically set date fields (e.g. start_date, cancelled_date)
  when a task transitions to a corresponding status. Proposes an optional date_property
  config on each status definition.
notes: |-
  Root cause:
  - Not a bug. Currently, status transitions only auto-set completedDate on completion. There is no generic mechanism to map arbitrary statuses to date properties.

  Suggested fix (preferred):
  - Extend the StatusConfig type (src/types/settings.ts) with an optional `dateProperty` field that references a task date field name.
  - In StatusManager or TaskService, when status is updated, check if the new status has a dateProperty configured and auto-populate the current date into that field.
  - This is complementary to issue #1703 (clear scheduled on in-progress) and could subsume it.

  Fallback options:
  - Implement as a TriggerConfigService rule (src/services/TriggerConfigService.ts) rather than a StatusConfig extension, allowing more flexible automation.
command_id: triage-issue
last_analyzed_at: '2026-03-22T00:00:00Z'
sync_state: clean
type: item_state
---
