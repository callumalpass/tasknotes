---
id: issue-1663
provider: github
kind: issue
key: callumalpass/tasknotes#1663
external_ref: https://github.com/callumalpass/tasknotes/issues/1663
repo: callumalpass/tasknotes
number: 1663
remote_state: open
remote_title: "[Bug]: Bug in Japanese tag display on Kanban board"
remote_author: "kutty-1119"
remote_url: https://github.com/callumalpass/tasknotes/issues/1663
local_status: triaged
priority: medium
difficulty: easy
risk: low
summary: "Tag styling not applied to Japanese (Unicode) tags in Kanban board view"
notes: |
  ## Root cause / Scope
  The `normalizeTag` function in `src/ui/renderers/tagRenderer.ts` uses a Unicode-aware regex `[^\p{L}\p{N}_#/-]` to clean tag strings, which correctly preserves Japanese characters. The tag element is rendered with `cls: "tag"` which should pick up Obsidian's default tag CSS. However, Obsidian's CSS for tag styling (rounded corners, background) commonly uses a CSS attribute selector like `a.tag[href^="#"]` and matches based on the `href` attribute value. If the normalized Japanese tag produces a href that Obsidian's CSS doesn't match (e.g. due to encoding differences or the CSS using an ASCII-only pattern), the styling will not apply. This explains why `#test` (ASCII) gets styled but `#テスト` (Japanese) does not on the Kanban board, even though the task creation view may apply styling through a different code path.

  ## Suggested fix / Approach
  Investigate whether the Kanban card tag rendering path differs from the task creation view. Check if the `href` attribute on the tag anchor element uses the normalized form with the `#` prefix for Japanese characters. If Obsidian's CSS selector uses a regex or prefix match that fails on multi-byte characters, a CSS workaround or explicit class addition may be needed. The fix is likely in `src/ui/renderers/tagRenderer.ts` (renderTag) or in the CSS, ensuring `href` is set correctly and the element's `class` includes whatever Obsidian needs to apply tag styling for all Unicode characters.
command_id: triage-issue
last_analyzed_at: "2026-03-31"
sync_state: clean
type: item_state
---
