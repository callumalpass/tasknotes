---
id: issue-1671
provider: github
kind: issue
key: callumalpass/tasknotes#1671
external_ref: https://github.com/callumalpass/tasknotes/issues/1671
repo: callumalpass/tasknotes
number: 1671
remote_state: open
remote_title: "[FR]: Show Timeblock Descriptions in Calendar View"
remote_author: "wohaha7"
remote_url: https://github.com/callumalpass/tasknotes/issues/1671
local_status: triaged
priority: low
difficulty: easy
risk: low
summary: "FR: Display timeblock description/summary text directly on calendar event blocks"
notes: |
  ## Root cause / Scope
  Timeblock descriptions are stored in the daily note frontmatter but the calendar event rendering in `src/bases/CalendarView.ts` (and `TimeBlockCard`) only shows the title and time range on the event block. The description is accessible only by clicking into the timeblock detail view, breaking the at-a-glance calendar experience.

  ## Suggested fix / Approach
  In the FullCalendar event rendering for timeblocks (likely in the `eventContent` or similar callback in `CalendarView.ts`), append the description text below the title with a smaller font size. Optionally gate this behind a new calendar option (e.g. `showTimeblockDescriptions`) so users can toggle it. CSS would use `white-space: pre-wrap` and `overflow: hidden` with ellipsis for short blocks. This is an easy, isolated UI change confined to the calendar event rendering and optional settings registration.
command_id: triage-issue
last_analyzed_at: "2026-03-31"
sync_state: clean
type: item_state
---
