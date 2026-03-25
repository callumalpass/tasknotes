---
id: 'github:callumalpass/tasknotes:issue:1721'
provider: github
kind: issue
key: '1721'
external_ref: callumalpass/tasknotes#1721
repo: callumalpass/tasknotes
number: 1721
remote_state: OPEN
remote_title: >-
  [Bug]: Website bug: links not clickable on mobile
remote_author: devynosborne
remote_url: 'https://github.com/callumalpass/tasknotes/issues/1721'
local_status: triaged
priority: low
difficulty: trivial
risk: low
summary: >-
  Links on the TaskNotes website (not the plugin) are not clickable on mobile iOS Safari/Chrome.
  This is a website bug, not a plugin bug.
notes: |-
  Root cause:
  - This is a website issue, not a plugin issue. The TaskNotes documentation/marketing website
    has links that are not responding to tap events on iOS mobile browsers. Likely a CSS issue
    (z-index, pointer-events, or overlay element intercepting taps) on the website.

  Suggested fix (preferred):
  - Investigate the website repository for CSS issues affecting link tap targets on mobile.
    Common causes include overlay elements with pointer-events: auto, or elements with high
    z-index covering links.

  Fallback options:
  - This may be out of scope for the plugin repository if the website is maintained separately.
    Consider redirecting to the website repository if one exists.
command_id: triage-issue
last_analyzed_at: '2026-03-26T00:03:00Z'
sync_state: clean
type: item_state
---
