---
id: issue-1721
provider: github
kind: issue
key: callumalpass/tasknotes#1721
external_ref: https://github.com/callumalpass/tasknotes/issues/1721
repo: callumalpass/tasknotes
number: 1721
remote_state: open
remote_title: "[Bug]: Website bug: links not clickable on mobile"
remote_author: "devynosborne"
remote_url: https://github.com/callumalpass/tasknotes/issues/1721
local_status: triaged
priority: medium
difficulty: easy
risk: low
summary: "Links on the TaskNotes documentation website are not clickable on iOS mobile browsers (Safari and Chrome)"
notes: |
  ## Root cause / Scope
  This is a website/docs issue, not a plugin code issue. On iOS 18.x, tap events on anchor elements can be suppressed if a non-interactive parent element (div, span) lacks cursor:pointer CSS or if an overlay/pseudo-element captures the touch event. Common causes in static documentation sites include: a sticky nav or hero overlay with a high z-index covering link areas, pointer-events:none inadvertently set on a parent, or a CSS :hover-only focus trap that does not translate to touch. The repository contains a docs/ directory and docs-builder/ suggesting a static site generator is used.

  ## Suggested fix / Approach
  Inspect the generated HTML/CSS for links on the docs site on mobile. Ensure no full-viewport overlay element (e.g. a mobile nav backdrop) remains visible with pointer-events capturing taps. Add cursor:pointer to all interactive link containers. Test on iOS Safari and Chrome using browser dev tools remote debugging. The fix is isolated to the docs website CSS/layout and has no impact on plugin code.
command_id: triage-issue
last_analyzed_at: "2026-03-31"
sync_state: clean
type: item_state
---
