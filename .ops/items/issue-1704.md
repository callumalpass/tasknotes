---
id: issue-1704
provider: github
kind: issue
key: callumalpass/tasknotes#1704
external_ref: https://github.com/callumalpass/tasknotes/issues/1704
repo: callumalpass/tasknotes
number: 1704
remote_state: open
remote_title: "[FR]: option widen today on multi-day calendar"
remote_author: "dictionarymouse"
remote_url: https://github.com/callumalpass/tasknotes/issues/1704
local_status: triaged
priority: low
difficulty: medium
risk: low
summary: "FR: option to display today's column wider than other days in week/multi-day calendar view"
notes: |
  ## Root cause / Scope
  FullCalendar (the underlying calendar library used by `CalendarView.ts`) does not natively support
  variable-width day columns in its timeGrid views. Implementing this would require either a custom
  FullCalendar plugin/patch or post-render DOM manipulation to resize the today column.

  ## Suggested fix / Approach
  After FullCalendar renders, apply a CSS transform or explicit width override to the column
  corresponding to today's date. This can be done in the `datesSet` callback by selecting
  `.fc-day-today` columns and adjusting flex proportions. A view option (e.g., `todayColumnWidthMultiplier`)
  could control the ratio. This is cosmetic and should be low risk if scoped to a CSS/DOM post-render
  hook. However, it may interact with FullCalendar's internal layout calculations and should be
  tested across view types.
command_id: triage-issue
last_analyzed_at: "2026-03-31"
sync_state: clean
type: item_state
---
