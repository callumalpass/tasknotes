---
id: 'github:callumalpass/tasknotes:issue:1643'
provider: github
kind: issue
key: '1643'
external_ref: callumalpass/tasknotes#1643
repo: callumalpass/tasknotes
number: 1643
remote_state: OPEN
remote_title: >-
  [Bug]: Embedded calendar view has buggy embedding between source and preview
  note view
remote_author: linkion
remote_url: 'https://github.com/callumalpass/tasknotes/issues/1643'
local_status: triaged
priority: low
difficulty: hard
risk: medium
summary: >-
  Embedded calendar views (via `![[agenda-default.base]]`) render differently
  and with visual glitches between source mode (live preview) and reading
  (preview) mode due to differing container sizing and CSS contexts.
notes: |-
  Root cause:
  - When a `.base` file is embedded in a note, Obsidian renders it through different code paths for source mode (CodeMirror widget) and reading mode (markdown post-processor).
  - The FullCalendar container inherits different parent dimensions, CSS custom properties, and overflow behaviors depending on the mode, causing layout discrepancies.
  - The calendar's responsive layout depends on the container width being stable at render time; in preview mode the container may be sized differently or reflowed after the calendar initializes.

  Suggested fix (preferred):
  - Add explicit container sizing and CSS normalization for embedded calendar views. Use a ResizeObserver to re-render the calendar when the container dimensions change.
  - Ensure the calendar view's `containerEl` gets consistent CSS class names and dimensions regardless of embed context.

  Fallback options:
  - Document this as a known limitation of Obsidian's embed rendering and suggest using the calendar in a sidebar/tab instead of embedded.
  - Add a `requestAnimationFrame` delay before initializing the calendar in embedded contexts to allow the container to settle.
command_id: triage-issue
last_analyzed_at: '2026-03-22T00:00:00Z'
sync_state: clean
type: item_state
---
