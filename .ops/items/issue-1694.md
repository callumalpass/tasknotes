---
id: 'github:callumalpass/tasknotes:issue:1694'
provider: github
kind: issue
key: '1694'
external_ref: callumalpass/tasknotes#1694
repo: callumalpass/tasknotes
number: 1694
remote_state: OPEN
remote_title: >-
  [Bug]: Enabling taskNotes on iPad causes back arrow to freeze Obsidian on my most frequently used file
remote_author: wealthychef1
remote_url: 'https://github.com/callumalpass/tasknotes/issues/1694'
local_status: triaged
priority: medium
difficulty: complex
risk: low
summary: >-
  On iPad only, navigating back to a specific note containing multiple Bases
  views causes Obsidian to hang. The issue is specific to one file and only
  occurs when TaskNotes is enabled, suggesting a re-render loop or excessive
  computation during view restoration.
notes: |-
  Root cause:
  - Not definitively identified due to lack of reproducibility on desktop.
    Most likely a re-render cascade triggered when Obsidian restores the
    view state on back-navigation. Multiple Bases views in a single note
    could cause concurrent re-initialization, and on iPad's more constrained
    event loop, this could block the main thread indefinitely.
  - The fact that the virtual keyboard back button works but the toolbar
    back button doesn't suggests different navigation code paths in Obsidian
    mobile, with one triggering a full view re-render and the other not.

  Suggested fix (preferred):
  - Add render debouncing / throttling to BasesViewBase initialization so
    multiple views in a single note don't all re-render simultaneously.
  - Add a safeguard timeout to break potential infinite re-render loops in
    the Bases view lifecycle.

  Fallback options:
  - Request the user share the specific .base file configuration and vault
    structure for targeted debugging.
  - Add performance logging (behind a debug flag) to track view lifecycle
    timing on mobile.
command_id: triage-issue
last_analyzed_at: '2026-03-22T00:00:00Z'
sync_state: clean
type: item_state
---
