---
id: issue-1643
provider: github
kind: issue
key: callumalpass/tasknotes#1643
external_ref: https://github.com/callumalpass/tasknotes/issues/1643
repo: callumalpass/tasknotes
number: 1643
remote_state: open
remote_title: "[Bug]: Embedded calendar view has buggy embedding between source and preview note view"
remote_author: "linkion"
remote_url: https://github.com/callumalpass/tasknotes/issues/1643
local_status: triaged
priority: medium
difficulty: hard
risk: low
summary: "Embedded .base calendar view renders differently in source vs preview mode due to Obsidian embedding context differences"
notes: |
  ## Root cause / Scope
  When a `.base` file is embedded in a note (`![[agenda-default.base]]`), Obsidian renders it inside an iframe-like embedding context. The calendar view's CSS and layout logic may behave differently depending on whether the host note is in source or reading/preview mode. In source mode the embedding may get different container dimensions or CSS cascade compared to reading mode. The CalendarView component in `CalendarView.ts` uses FullCalendar, which is sensitive to container width/height at initialization time. If the container has different dimensions or display properties between source and preview, FullCalendar may render with incorrect sizing or layout.

  ## Suggested fix / Approach
  This is partially an Obsidian platform constraint. Mitigations could include: (1) calling `calendar.updateSize()` after the embedding context settles via a ResizeObserver; (2) deferring calendar initialization until the container has non-zero dimensions; (3) adding CSS overrides scoped to the embedded context that normalize container sizing. The core fix requires coordinating between the Bases embedding lifecycle and FullCalendar's render cycle. Risk is low since it's display-only, but difficulty is hard due to the Obsidian internal embedding API dependency.
command_id: triage-issue
last_analyzed_at: "2026-03-31"
sync_state: clean
type: item_state
---
