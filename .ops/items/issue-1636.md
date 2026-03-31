---
id: issue-1636
provider: github
kind: issue
key: callumalpass/tasknotes#1636
external_ref: https://github.com/callumalpass/tasknotes/issues/1636
repo: callumalpass/tasknotes
number: 1636
remote_state: open
remote_title: "[Bug]: CSS issues with list button in calendar view"
remote_author: "vroablec"
remote_url: https://github.com/callumalpass/tasknotes/issues/1636
local_status: triaged
priority: low
difficulty: easy
risk: low
summary: "FullCalendar list-week button renders as 'fc-list WeekButton-button' in DOM but CSS targets 'fc-listWeek-button', breaking active-state styling"
notes: |
  ## Root cause / Scope
  In `styles/advanced-calendar-view.css` at line 671, the CSS rule targets `.fc-listWeek-button`. However, the user reports that the actual DOM class rendered by FullCalendar is `fc-list WeekButton-button` (with a space, implying two classes: `fc-list` and `WeekButton-button`). This is likely a FullCalendar version change in how button class names are generated — newer FullCalendar versions may use a different naming convention for custom view buttons. The mismatch means the active background color and active class styling do not apply to the list view button.

  ## Suggested fix / Approach
  Inspect the exact class name rendered by the current FullCalendar version bundled in the plugin. Update the CSS selector in `advanced-calendar-view.css` to match. If FullCalendar generates both `fc-listWeek-button` and the spaced variant depending on version, add both selectors. Consider using attribute selectors (e.g., `[class*="fc-list"]`) as a more resilient approach.
command_id: triage-issue
last_analyzed_at: "2026-03-31"
sync_state: clean
type: item_state
---
