---
id: 'github:callumalpass/tasknotes:issue:1686'
provider: github
kind: issue
key: '1686'
external_ref: callumalpass/tasknotes#1686
repo: callumalpass/tasknotes
number: 1686
remote_state: OPEN
remote_title: >-
  [Bug]: When creating a new timeblock from the advanced calendar view in a different week, the view resets to the current week
remote_author: Lorite
remote_url: 'https://github.com/callumalpass/tasknotes/issues/1686'
local_status: triaged
priority: medium
difficulty: easy
risk: low
summary: >-
  Creating a timeblock via the calendar view context menu while viewing a
  non-current week causes the view to snap back to the current week instead
  of staying on the viewed week.
notes: |-
  Root cause:
  - In CalendarView.handleDateSelect() (line 1670), the call to
    this.expectImmediateUpdate() triggers a calendar re-render. The
    timeblock creation flow (handleTimeblockCreation in calendar-core.ts)
    likely triggers a data refresh that re-initializes the calendar date
    to today rather than preserving the current viewed date.
  - The same issue is noted in #1513 for task creation.

  Suggested fix (preferred):
  - Before triggering the update after timeblock creation, capture the
    current calendar date via this.calendar.getDate(). After the data
    refresh, restore the calendar to the captured date using
    this.calendar.gotoDate(). This pattern should be applied in
    handleDateSelect for all creation types (task, timeblock, time entry).

  Fallback options:
  - Store the current viewed date range in view state and restore it
    after any data refresh cycle.
command_id: triage-issue
last_analyzed_at: '2026-03-22T00:00:00Z'
sync_state: clean
type: item_state
---
