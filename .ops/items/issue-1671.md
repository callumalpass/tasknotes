---
id: 'github:callumalpass/tasknotes:issue:1671'
provider: github
kind: issue
key: '1671'
external_ref: callumalpass/tasknotes#1671
repo: callumalpass/tasknotes
number: 1671
remote_state: OPEN
remote_title: >-
  [FR]: Show Timeblock Descriptions in Calendar View
remote_author: wohaha7
remote_url: 'https://github.com/callumalpass/tasknotes/issues/1671'
local_status: triaged
priority: low
difficulty: easy
risk: low
summary: >-
  Feature request to render the timeblock description/summary text directly on calendar event blocks
  below the title, so users can see details at a glance without clicking.
notes: |-
  Root cause:
  - Not a bug. The calendar event rendering in src/bases/calendar-core.ts and CalendarView.ts
    only displays the timeblock title. The description data is available but not rendered inline.

  Suggested fix (preferred):
  - In the FullCalendar event render callback (calendar-core.ts), append the description text below
    the title element with a smaller font size and overflow handling. Add an optional toggle in
    calendar view settings to show/hide descriptions.

  Fallback options:
  - Show descriptions only on hover via a tooltip rather than inline rendering.
command_id: triage-issue
last_analyzed_at: '2026-03-22T00:00:00Z'
sync_state: clean
type: item_state
---
