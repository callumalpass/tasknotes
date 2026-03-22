---
id: 'github:callumalpass/tasknotes:issue:1634'
provider: github
kind: issue
key: '1634'
external_ref: callumalpass/tasknotes#1634
repo: callumalpass/tasknotes
number: 1634
remote_state: OPEN
remote_title: >-
  [Bug]: Custom Icon for Inline Tasks Not Aligned on Hover
remote_author: ttlaylor
remote_url: 'https://github.com/callumalpass/tasknotes/issues/1634'
local_status: triaged
priority: low
difficulty: trivial
risk: low
summary: >-
  When a custom icon is configured for a task status, the hover state fill
  circle on inline tasks is misaligned with the icon. The inline layout CSS
  lacks icon-specific hover styling that the standard task card layout has.
notes: |-
  Root cause:
  - `src/ui/TaskCard.ts` adds the `task-card__status-dot--icon` class when a custom icon is configured, and `styles/task-card-bem.css` (lines 347-377) provides icon-specific styling including proper dimensions and transparent background.
  - The inline layout override in `task-card-bem.css` (line 1235) sets `task-card--layout-inline .task-card__status-dot` to `display: inline-block` with `0.85em` dimensions and `transform: translateY(0.1em)`.
  - However, there is no inline-specific override for `.task-card--layout-inline .task-card__status-dot--icon` or its hover state, so the icon SVG and the hover circle use different sizing/positioning, causing misalignment.

  Suggested fix (preferred):
  - Add CSS rules for `.task-card--layout-inline .task-card__status-dot--icon` and its hover state in `task-card-bem.css` that properly size the SVG icon to match the inline dot dimensions and ensure the hover effect aligns.

  Fallback options:
  - Remove the `transform` on the inline status dot to simplify alignment, or use `vertical-align: middle` consistently for both icon and non-icon variants.
command_id: triage-issue
last_analyzed_at: '2026-03-22T00:00:00Z'
sync_state: clean
type: item_state
---
