---
id: 'github:callumalpass/tasknotes:issue:1621'
provider: github
kind: issue
key: '1621'
external_ref: callumalpass/tasknotes#1621
repo: callumalpass/tasknotes
number: 1621
remote_state: OPEN
remote_title: >-
  [Bug]:
remote_author: karenchoe428
remote_url: 'https://github.com/callumalpass/tasknotes/issues/1621'
local_status: triaged
priority: medium
difficulty: medium
risk: low
summary: >-
  Kanban swimlane label column takes up half the screen width on mobile,
  making it hard to read tasks and causing accidental drag-and-drop
  misplacements.
notes: |-
  Root cause:
  - The kanban swimlane layout does not have mobile-specific responsive CSS.
    The swimlane label column (class kanban-view__swimlane-label) uses a
    fixed or proportional width that is appropriate for desktop but takes
    up excessive space on narrow mobile screens.
  - There is no option to hide or collapse the frozen swimlane label pane
    on mobile.

  Suggested fix (preferred):
  - Add mobile-responsive CSS in styles/kanban-view.css using
    .is-mobile or @media queries to reduce the swimlane label column width
    on small screens (e.g., max-width: 80px or collapse to icon-only).
  - Optionally make the swimlane label column collapsible/toggleable on
    mobile.

  Fallback options:
  - Add a setting to disable swimlane frozen pane on mobile.
  - On mobile, render swimlanes as stacked sections instead of a table
    layout so the label doesn't consume horizontal space.
command_id: triage-issue
last_analyzed_at: '2026-03-22T00:00:00Z'
sync_state: clean
type: item_state
---
