---
id: 'github:callumalpass/tasknotes:issue:1688'
provider: github
kind: issue
key: '1688'
external_ref: callumalpass/tasknotes#1688
repo: callumalpass/tasknotes
number: 1688
remote_state: OPEN
remote_title: >-
  [Bug]: Can't open inline tasks within the enclosing note
remote_author: hokfujow
remote_url: 'https://github.com/callumalpass/tasknotes/issues/1688'
local_status: triaged
priority: high
difficulty: medium
risk: medium
summary: >-
  Clicking or double-clicking inline task links (wikilinks to TaskNotes) within
  the enclosing note no longer opens the task widget/modal. Right-click and
  status icon clicks still work. The issue is intermittent and recent.
notes: |-
  Root cause:
  - Likely a regression in the click handler registration for inline task
    links in reading mode. The ReadingModeTaskLinkProcessor
    (src/editor/ReadingModeTaskLinkProcessor.ts) replaces wikilinks with
    task preview widgets, and the click handlers are attached via
    createTaskClickHandler (src/utils/clickHandlers.ts). If the task link
    widget DOM is being recreated (e.g., by a re-render) after the click
    handler is attached, the handler would be lost.
  - The intermittent nature ("occasionally they open as expected but then
    immediately after, they stop working") strongly suggests a race condition
    where a re-render or DOM update strips the click handlers.
  - The TaskLinkWidget (src/editor/TaskLinkWidget.ts) and TaskLinkOverlay
    (src/editor/TaskLinkOverlay.ts) manage the inline task display and may
    be involved.

  Suggested fix (preferred):
  - Use event delegation (attach click handler to a stable parent element)
    instead of directly on the task link widget DOM, so re-renders don't
    lose the handler.
  - Alternatively, ensure the click handler is re-attached whenever the
    widget DOM is rebuilt.

  Fallback options:
  - Add a MutationObserver to detect when task link DOM is replaced and
    re-attach handlers.
command_id: triage-issue
last_analyzed_at: '2026-03-22T00:00:00Z'
sync_state: clean
type: item_state
---
