---
id: issue-1742
provider: github
kind: issue
key: callumalpass/tasknotes#1742
external_ref: https://github.com/callumalpass/tasknotes/issues/1742
repo: callumalpass/tasknotes
number: 1742
remote_state: open
remote_title: "[Bug]: Calendar view timeline is shifted to the center"
remote_author: "ysafonov"
remote_url: https://github.com/callumalpass/tasknotes/issues/1742
local_status: triaged
priority: medium
difficulty: easy
risk: low
summary: "In the latest version the time-axis (left sidebar of the week/day timegrid) is visually shifted toward the center instead of being pinned to the left"
notes: |
  ## Root cause / Scope
  FullCalendar renders the timegrid with a `fc-timegrid-axis` column that must be left-anchored within its `fc-scrollgrid-section` row. The CSS in `styles/advanced-calendar-view.css` sets `.fc-timegrid-axis { width: 4rem }` but a recent change may have introduced a conflicting `justify-content`, `flex` layout, or removed a `position: sticky; left: 0` rule on the scroll container, causing the axis column to float toward the center when the scrollgrid table is forced to `width: 100% !important`. This manifests as the time labels appearing in the middle of the view rather than flush-left.

  ## Suggested fix / Approach
  Inspect the `.fc-scrollgrid-section-header`, `.fc-scrollgrid-section-body`, and their direct `td`/`th` children in DevTools. Add or restore `position: sticky; left: 0` on `.advanced-calendar-view .fc-timegrid-axis` and ensure the containing table cell has `overflow: visible` so sticky positioning works. Alternatively, verify that the `width: 100% !important` rule on `.fc-scrollgrid-sync-table` is not causing the axis cell to be stretched.
command_id: triage-issue
last_analyzed_at: "2026-03-31"
sync_state: clean
type: item_state
---
