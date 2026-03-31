---
id: issue-1649
provider: github
kind: issue
key: callumalpass/tasknotes#1649
external_ref: https://github.com/callumalpass/tasknotes/issues/1649
repo: callumalpass/tasknotes
number: 1649
remote_state: open
remote_title: "[Bug]: Daily note on Day view is not working"
remote_author: "BaccanoMob"
remote_url: https://github.com/callumalpass/tasknotes/issues/1649
local_status: triaged
priority: medium
difficulty: medium
risk: low
summary: "Clicking the day header in FullCalendar Day view does not open the daily note because FullCalendar does not render navLink anchors for single-day views"
notes: |
  ## Root cause / Scope
  `CalendarView.ts` configures FullCalendar with `navLinks: true` and `navLinkDayClick` handler pointing to `handleDateTitleClick`. In multi-day views (week, month, list), FullCalendar renders the column header date cells as proper `<a>` elements with `data-navlink=""`, which triggers the `navLinkDayClick` callback. In the single-day (`timeGridDay`) view, FullCalendar renders the header as a non-link `<a class="fc-col-header-cell-cushion">` element with no `data-navlink` attribute and an empty `title=""` — meaning the nav-link click mechanism is never triggered. The user's HTML inspection confirms this difference.

  ## Suggested fix / Approach
  Override the day header via FullCalendar's `dayHeaderDidMount` or `dayHeaderContent` callback to attach a manual click handler when in the `timeGridDay` view. Alternatively, add a MutationObserver or `viewDidMount` hook that manually attaches a click listener to the `.fc-col-header-cell-cushion` element when the view is `timeGridDay`. The date for that header can be read from the calendar's current date. This is a medium-effort change requiring view-type-specific DOM event handling in `CalendarView.ts`.
command_id: triage-issue
last_analyzed_at: "2026-03-31"
sync_state: clean
type: item_state
---
