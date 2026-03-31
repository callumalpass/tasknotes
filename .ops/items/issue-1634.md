---
id: issue-1634
provider: github
kind: issue
key: callumalpass/tasknotes#1634
external_ref: https://github.com/callumalpass/tasknotes/issues/1634
repo: callumalpass/tasknotes
number: 1634
remote_state: open
remote_title: "[Bug]: Custom Icon for Inline Tasks Not Aligned on Hover"
remote_author: "ttlaylor"
remote_url: https://github.com/callumalpass/tasknotes/issues/1634
local_status: triaged
priority: low
difficulty: easy
risk: low
summary: "In inline task layout, the hover fill effect on a custom SVG icon status dot renders at a different position than the base icon due to conflicting size/transform rules"
notes: |
  ## Root cause / Scope
  In `styles/task-card-bem.css`, the inline layout rule `.task-card--layout-inline .task-card__status-dot` sets `width: 0.85em; height: 0.85em; vertical-align: baseline; transform: translateY(0.1em)` (lines 1256–1264). The general SVG inline rule (lines 1346–1352) applies the same dimensions to all `svg` descendants. However, the `--icon` variant classes (`.task-card__status-dot--icon` and `.task-card__status-dot--icon:hover svg`) are defined with `display: inline-flex` and `width/height: 18px` (fixed px) in the non-layout section. When the inline layout overrides size to `0.85em`, the hover SVG fill effect targets the `svg` element, but position offsets may differ from the visible icon's rendered bounding box, causing visual misalignment.

  ## Suggested fix / Approach
  Add a specific rule for `.task-card--layout-inline .task-card__status-dot--icon` that resets `display` to `inline-flex` and ensures `width/height` matches the svg child's size. Alternatively, ensure the hover pseudo-state uses `currentColor` fill on the same element rather than repositioning a second visual element.
command_id: triage-issue
last_analyzed_at: "2026-03-31"
sync_state: clean
type: item_state
---
