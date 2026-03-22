---
id: 'github:callumalpass/tasknotes:issue:1709'
provider: github
kind: issue
key: '1709'
external_ref: callumalpass/tasknotes#1709
repo: callumalpass/tasknotes
number: 1709
remote_state: OPEN
remote_title: >-
  [Bug]: relationship.base renders multiple times when default view is set to
  Reading view
remote_author: CarlJohnson99
remote_url: 'https://github.com/callumalpass/tasknotes/issues/1709'
local_status: triaged
priority: medium
difficulty: medium
risk: medium
summary: >-
  The relationships widget in reading/preview mode renders 2-3 duplicate instances
  when the default view is set to Reading view. The injectReadingModeWidget function
  is called multiple times during initialization without proper deduplication.
notes: |-
  Root cause:
  - In src/editor/RelationshipsDecorations.ts, setupReadingModeHandlers() registers multiple event listeners (active-leaf-change, metadata-change, layout-change) that all call injectReadingModeWidget().
  - injectReadingModeWidget() (line ~476) does remove existing widgets before injecting, but when the default view is Reading view, multiple events fire simultaneously during workspace initialization (layout-ready + active-leaf-change + initial injection at line ~585-588).
  - The cleanup at line ~479 uses querySelectorAll on the container, but if multiple calls are in-flight concurrently (async function), the first call's cleanup may not see widgets injected by a concurrent call.

  Suggested fix (preferred):
  - Add a per-leaf debounce or mutex to injectReadingModeWidget() to prevent concurrent injections for the same leaf. A simple approach: track a Set of currently-injecting leaf IDs and skip if already in progress.
  - Alternatively, add a synchronous guard flag on the widget container element (e.g. a data attribute) checked before injection.

  Fallback options:
  - Increase the debounce timer in debouncedRefresh (currently 500ms may not be enough during initial load).
  - Use requestAnimationFrame to batch all injection calls into a single frame.
command_id: triage-issue
last_analyzed_at: '2026-03-22T00:00:00Z'
sync_state: clean
type: item_state
---
