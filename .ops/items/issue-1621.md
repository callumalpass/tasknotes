---
id: issue-1621
provider: github
kind: issue
key: callumalpass/tasknotes#1621
external_ref: https://github.com/callumalpass/tasknotes/issues/1621
repo: callumalpass/tasknotes
number: 1621
remote_state: open
remote_title: "[Bug]:"
remote_author: "karenchoe428"
remote_url: https://github.com/callumalpass/tasknotes/issues/1621
local_status: triaged
priority: medium
difficulty: easy
risk: low
summary: "Kanban swimlane label column takes up ~50% of mobile screen width, making tasks hard to read and drag"
notes: |
  ## Root cause / Scope
  On mobile Obsidian, the frozen swimlane label column in Kanban view occupies roughly half the viewport width. The CSS for the swimlane column (`kanban-view__swimlane-column`) does not have a mobile-specific `max-width` or a responsive breakpoint that reduces its size on narrow viewports. The user also reports accidental task drops because the pane obscures target columns. There is no option to disable or collapse the freeze pane on mobile.

  ## Suggested fix / Approach
  Add a `@media (max-width: 768px)` rule in `styles/kanban-view.css` to constrain the swimlane label column to a narrower fixed width (e.g., 80–100px) or make it collapsible. Alternatively, add a plugin setting "Freeze swimlane pane on mobile" (default on for backwards compatibility) that, when disabled, renders swimlane labels as inline row headers instead of a sticky column.
command_id: triage-issue
last_analyzed_at: "2026-03-31"
sync_state: clean
type: item_state
---
