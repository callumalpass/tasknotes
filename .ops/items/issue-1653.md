---
id: 'github:callumalpass/tasknotes:issue:1653'
provider: github
kind: issue
key: '1653'
external_ref: callumalpass/tasknotes#1653
repo: callumalpass/tasknotes
number: 1653
remote_state: OPEN
remote_title: >-
  [Bug]: Setting for position of relationships widget may be reversed
remote_author: hokfujow
remote_url: 'https://github.com/callumalpass/tasknotes/issues/1653'
local_status: triaged
priority: medium
difficulty: easy
risk: low
summary: >-
  The relationships widget position setting ("top" or "bottom") produces the
  opposite result of what the user selects. The DOM insertion logic in
  RelationshipsDecorations.ts may have the position branches swapped.
notes: |-
  Root cause:
  - In `src/editor/RelationshipsDecorations.ts`, the `relationshipsPosition` setting is read at lines 346 and 485.
  - The `position === "top"` branch inserts after metadata/task-card, and `else` (bottom) inserts before backlinks or at the end.
  - The logic appears correct in code, but the visual result may be inverted because of how Obsidian renders the sizer containers -- inserting "after metadata" in source mode may appear at the bottom visually, or the task-card widget insertion point shifts the expected position.
  - Needs manual testing to confirm whether the branch labels are truly swapped or if the DOM insertion target is wrong.

  Suggested fix (preferred):
  - Test and confirm the visual output for both "top" and "bottom" settings. If truly inverted, swap the conditional branches in both the source-mode handler (line ~366) and reading-mode handler (line ~500).

  Fallback options:
  - Add a more explicit DOM positioning strategy that uses `prepend`/`append` on the sizer rather than sibling-relative insertion.
command_id: triage-issue
last_analyzed_at: '2026-03-22T00:00:00Z'
sync_state: clean
type: item_state
---
