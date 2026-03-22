---
id: 'github:callumalpass/tasknotes:issue:1628'
provider: github
kind: issue
key: '1628'
external_ref: callumalpass/tasknotes#1628
repo: callumalpass/tasknotes
number: 1628
remote_state: OPEN
remote_title: >-
  [Bug]: Tasks disappear
remote_author: Lanalangz
remote_url: 'https://github.com/callumalpass/tasknotes/issues/1628'
local_status: triaged
priority: high
difficulty: hard
risk: medium
summary: >-
  Tasks disappear from custom agenda views when switching between them. After
  viewing the default agenda then switching between custom due-only and
  scheduled-only views, non-recurring tasks vanish and require closing and
  reopening the window.
notes: |-
  Root cause:
  - Likely a stale data/filter state issue in the Bases view lifecycle. When
    switching between custom views (tabs) within the same Bases file, the
    BasesViewBase or the underlying Obsidian Bases data adapter may not fully
    refresh its dataset, causing filter state from a previous view to bleed
    into the next.
  - The fact that recurring tasks remain visible while normal tasks disappear
    suggests the issue may be in how the Bases data query caches or filters
    results, since recurring tasks may follow a different rendering path.
  - This could also be related to ViewStateManager persisting filter state
    across view switches in a way that compounds filters (e.g., "only due"
    + "only scheduled" = nothing matches).

  Suggested fix (preferred):
  - Investigate the view lifecycle in BasesViewBase to ensure filter state is
    fully reset when switching between views/tabs in the same Bases file.
  - Check if Obsidian's Bases API data refresh is being properly triggered
    on view tab switch.

  Fallback options:
  - Add a manual data refresh call when a view tab becomes active.
  - Clear any cached filter state in ViewStateManager on view switch.
command_id: triage-issue
last_analyzed_at: '2026-03-22T00:00:00Z'
sync_state: clean
type: item_state
---
