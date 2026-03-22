---
id: 'github:callumalpass/tasknotes:issue:1649'
provider: github
kind: issue
key: '1649'
external_ref: callumalpass/tasknotes#1649
repo: callumalpass/tasknotes
number: 1649
remote_state: OPEN
remote_title: >-
  [Bug]: Daily note on Day view is not working
remote_author: BaccanoMob
remote_url: 'https://github.com/callumalpass/tasknotes/issues/1649'
local_status: triaged
priority: medium
difficulty: medium
risk: low
summary: >-
  Clicking the day header in FullCalendar's Day (D) view does not open the daily
  note. The Day view renders the header as a plain text element without the
  navlink data attribute that other views use to trigger daily note navigation.
notes: |-
  Root cause:
  - FullCalendar's `navLinks: true` setting enables `navLinkDayClick` for multi-day views (week, month, list) where day headers render as `<a>` tags with `data-navlink` attributes.
  - In the single-Day view (`timeGridDay`), FullCalendar renders the column header as `<a class="fc-col-header-cell-cushion">Thursday</a>` without the `data-navlink` attribute, so `navLinkDayClick` is never triggered.
  - The `handleDateTitleClick` function in `src/bases/calendar-core.ts` is correctly implemented but never called in Day view.

  Suggested fix (preferred):
  - Add a `dayHeaderContent` or `dayHeaderDidMount` callback in the CalendarView options that attaches a click handler to the day column header in Day view, calling `handleDateTitleClick` with the currently displayed date.

  Fallback options:
  - Use FullCalendar's `viewDidMount` to query the `.fc-col-header-cell-cushion` element and attach a click listener manually.
  - Add a separate "Open daily note" button in the calendar toolbar when in Day view.
command_id: triage-issue
last_analyzed_at: '2026-03-22T00:00:00Z'
sync_state: clean
type: item_state
---
