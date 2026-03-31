---
id: issue-1653
provider: github
kind: issue
key: callumalpass/tasknotes#1653
external_ref: https://github.com/callumalpass/tasknotes/issues/1653
repo: callumalpass/tasknotes
number: 1653
remote_state: open
remote_title: "[Bug]: Setting for position of relationships widget may be reversed"
remote_author: "hokfujow"
remote_url: https://github.com/callumalpass/tasknotes/issues/1653
local_status: triaged
priority: low
difficulty: easy
risk: low
summary: "Relationships widget position setting may produce inverted behavior (top shows at bottom and vice versa)"
notes: |
  ## Root cause / Scope
  `RelationshipsDecorations.ts` reads `plugin.settings.relationshipsPosition` (default: `"bottom"`) and uses it to decide insertion point. The logic in both the live preview path (line 370) and reading mode path (line 510) appears correct: `position === "top"` inserts before content, `position === "bottom"` appends to end. The settings UI (`appearanceTab.ts`) correctly maps the dropdown values `"top"` and `"bottom"` to the setting. However, the DOM insertion logic for "top" inserts after the metadata container (properties), which in Obsidian's reading mode appears visually below the note body in some themes. The "bottom" path inserts before embedded backlinks, which may appear above the actual note content in certain layouts. A theme or Obsidian version change could have caused the visual positions to appear swapped without a code logic error.

  ## Suggested fix / Approach
  Audit the DOM structure in current Obsidian versions to verify that `.metadata-container` and `.markdown-preview-sizer` ordering matches expectations. If the insertion points have drifted from intended visual positions, update the selectors. This is a low-risk easy fix requiring only verification and possibly adjusting one DOM insertion call.
command_id: triage-issue
last_analyzed_at: "2026-03-31"
sync_state: clean
type: item_state
---
