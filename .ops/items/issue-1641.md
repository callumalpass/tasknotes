---
id: 'github:callumalpass/tasknotes:issue:1641'
provider: github
kind: issue
key: '1641'
external_ref: callumalpass/tasknotes#1641
repo: callumalpass/tasknotes
number: 1641
remote_state: OPEN
remote_title: >-
  [FR]: Multiple property based event times
remote_author: jhoogeboom
remote_url: 'https://github.com/callumalpass/tasknotes/issues/1641'
local_status: triaged
priority: low
difficulty: hard
risk: medium
summary: >-
  Feature request to allow a single task note to generate multiple calendar
  events by supporting lists of start/end date properties. Currently, the
  calendar view only reads a single start date property per task.
notes: |-
  Root cause:
  - The calendar event generation in `CalendarView.ts` and `calendar-core.ts` maps each task to exactly one event using a single start/end date pair from the task's frontmatter.
  - The `PropertyMappingService` and `BasesDataAdapter` are designed for scalar property values, not arrays of dates.

  Suggested fix (preferred):
  - This is a significant feature addition. The most feasible approach would be to support a `timeEntries`-like property (which already exists for time tracking) that can generate multiple calendar events per task.
  - Each entry in the list would produce a separate calendar event linked back to the same task note.

  Fallback options:
  - Suggest users create separate task notes for each time slot and link them via the relationships/dependencies system.
  - Document the `timeEntries` property as a partial workaround for multi-slot scheduling.
command_id: triage-issue
last_analyzed_at: '2026-03-22T00:00:00Z'
sync_state: clean
type: item_state
---
