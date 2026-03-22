---
id: 'github:callumalpass/tasknotes:issue:1663'
provider: github
kind: issue
key: '1663'
external_ref: callumalpass/tasknotes#1663
repo: callumalpass/tasknotes
number: 1663
remote_state: OPEN
remote_title: >-
  [Bug]: Bug in Japanese tag display on Kanban board
remote_author: kutty-1119
remote_url: 'https://github.com/callumalpass/tasknotes/issues/1663'
local_status: triaged
priority: medium
difficulty: easy
risk: low
summary: >-
  Japanese tags (e.g. #テスト) render without Obsidian's rounded-corner tag styling on the Kanban
  board, while English tags (#test) render correctly. The issue is likely in CSS selector matching
  rather than the tag rendering code.
notes: |-
  Root cause:
  - The renderTag function in src/ui/renderers/tagRenderer.ts creates an <a> element with
    cls="tag" and href="#テスト". Obsidian's built-in CSS styles tags using a selector like
    a.tag[href^="#"] or similar, which should match Unicode hrefs. However, the normalizeTag()
    function strips characters not matching [^\p{L}\p{N}_#/-], which should preserve Japanese.
    The more likely cause is that Obsidian's native tag CSS uses selectors that do not match
    CJK characters in the href attribute, or the href value encoding differs for non-Latin text.
    TaskCard.ts renders tags via renderTagsValue which delegates to renderTag - no separate
    Kanban-specific tag rendering exists.

  Suggested fix (preferred):
  - Add explicit TaskNotes CSS for .tag elements within the Kanban board context that applies the
    rounded-corner styling regardless of href content, ensuring CJK tags get the same visual
    treatment. Add rules in styles/kanban-view.css or styles/task-card-bem.css targeting
    .kanban-board .tag or .task-card .tag.

  Fallback options:
  - Modify renderTag to add a data-tag attribute with the tag text and use that for CSS styling
    instead of relying on Obsidian's href-based selectors.
command_id: triage-issue
last_analyzed_at: '2026-03-22T00:00:00Z'
sync_state: clean
type: item_state
---
