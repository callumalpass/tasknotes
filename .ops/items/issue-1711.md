---
id: issue-1711
provider: github
kind: issue
key: callumalpass/tasknotes#1711
external_ref: https://github.com/callumalpass/tasknotes/issues/1711
repo: callumalpass/tasknotes
number: 1711
remote_state: open
remote_title: "[Bug]: end time field not selectable in timeblock creation modal"
remote_author: "Jalpara"
remote_url: https://github.com/callumalpass/tasknotes/issues/1711
local_status: triaged
priority: medium
difficulty: easy
risk: low
summary: "The end time input field in the timeblock creation modal cannot be interacted with (selected/typed into)"
notes: |
  ## Root cause / Scope
  The bug body shows a screenshot where end time cannot be selected. In src/modals/TimeblockCreationModal.ts the end time input is created with type="time" inside a Setting widget. The onChange handler contains a special case that converts "00:00" to "23:59". The field itself is rendered similarly to the start time field. A likely cause is a CSS or z-index issue where an overlapping element from the containing timeblock-time-container div intercepts pointer events on the end time input, or alternatively the input type="time" native browser widget loses focus/interactivity on certain platforms (mobile/desktop Obsidian) because the parent Setting element captures the event. Another possibility is that the endTimeInput reference is correctly set but an accidental tabIndex=-1 or disabled attribute is applied elsewhere.

  ## Suggested fix / Approach
  Inspect the rendered DOM in the timeblock-creation-modal to verify the end time input has no pointer-events:none or disabled state applied. Ensure the timeblock-time-container does not have any layout property that blocks interaction with the second child Setting. Add explicit focus/click handling if needed, or restructure the end time field to match exactly the start time field construction to eliminate any divergence.
command_id: triage-issue
last_analyzed_at: "2026-03-31"
sync_state: clean
type: item_state
---
