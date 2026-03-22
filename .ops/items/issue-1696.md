---
id: 'github:callumalpass/tasknotes:issue:1696'
provider: github
kind: issue
key: '1696'
external_ref: callumalpass/tasknotes#1696
repo: callumalpass/tasknotes
number: 1696
remote_state: OPEN
remote_title: >-
  [Bug]: Google Calendar export ignores independently rescheduled next occurrence for recurring tasks
remote_author: martin-forge
remote_url: 'https://github.com/callumalpass/tasknotes/issues/1696'
local_status: triaged
priority: medium
difficulty: hard
risk: medium
summary: >-
  Google Calendar export always uses DTSTART from the recurrence rule as the
  event start date, ignoring the task's independently rescheduled scheduled
  date. This causes TaskNotes and Google Calendar to show different dates for
  the next occurrence.
notes: |-
  Root cause:
  - In TaskCalendarSyncService.buildCalendarEvent() (lines 634-658), when a
    task has a recurrence rule, the event start date is unconditionally
    overridden with recurrenceData.dtstart from the RRULE. The task's
    scheduled field (which holds the rescheduled next occurrence) is ignored
    for recurring tasks.
  - The Google Calendar API has no native concept of "next occurrence override"
    for recurring events. Google treats recurring events as a series derived
    from RRULE + DTSTART, with exceptions only via EXDATE or single-instance
    patches.

  Suggested fix (preferred):
  - When task.scheduled differs from the DTSTART-derived next occurrence,
    create an EXDATE for the original occurrence date and a separate one-off
    event (or a single-instance patch via Google Calendar API) for the
    rescheduled date. This preserves the long-term recurrence while showing
    the correct next occurrence.

  Fallback options:
  - Use the Google Calendar API's instance patch mechanism to modify only the
    next occurrence of the recurring event to match task.scheduled.
  - Document that rescheduling next occurrence is a TaskNotes-only concept
    not fully supported in Google Calendar export.
command_id: triage-issue
last_analyzed_at: '2026-03-22T00:00:00Z'
sync_state: clean
type: item_state
---
