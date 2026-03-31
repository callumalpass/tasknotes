---
id: issue-1696
provider: github
kind: issue
key: callumalpass/tasknotes#1696
external_ref: https://github.com/callumalpass/tasknotes/issues/1696
repo: callumalpass/tasknotes
number: 1696
remote_state: open
remote_title: "[Bug]: Google Calendar export ignores independently rescheduled next occurrence for recurring tasks"
remote_author: "martin-forge"
remote_url: https://github.com/callumalpass/tasknotes/issues/1696
local_status: triaged
priority: medium
difficulty: medium
risk: medium
summary: "Google Calendar sync ignores the rescheduled next occurrence of a recurring task, anchoring to the DTSTART instead"
notes: |
  ## Root cause / Scope
  In `TaskCalendarSyncService.buildEventFromTask()` (around line 624-658), when a task is synced as
  a recurring event, `convertToGoogleRecurrence()` extracts the `DTSTART` from the recurrence rule
  string and the code explicitly overrides the event's `start` date with `recurrenceData.dtstart`
  (the original recurrence anchor). This happens unconditionally, even when `task.scheduled` has
  been independently moved to a different date as a "next occurrence reschedule". As a result, the
  Google Calendar event always starts at the DTSTART date, ignoring the rescheduled `scheduled` field.

  ## Suggested fix / Approach
  When a recurring task has `scheduled` set to a date that differs from the DTSTART in the recurrence
  rule, the Google Calendar event should use `task.scheduled` as the next occurrence start and express
  the rescheduled instance using a Google Calendar EXDATE + standalone exception event pattern, or
  simply update the event start to `task.scheduled` without modifying the recurrence series. The
  cleanest approach: if `task.scheduled` differs from the DTSTART date, add the DTSTART date as an
  EXDATE (to hide the original occurrence) and set the event start to `task.scheduled`, keeping the
  rest of the recurrence series intact.
command_id: triage-issue
last_analyzed_at: "2026-03-31"
sync_state: clean
type: item_state
---
