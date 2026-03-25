---
id: 'github:callumalpass/tasknotes:issue:1719'
provider: github
kind: issue
key: '1719'
external_ref: callumalpass/tasknotes#1719
repo: callumalpass/tasknotes
number: 1719
remote_state: OPEN
remote_title: >-
  [Bug]: Inline task card mispositioned in reading mode on Obsidian 1.12.x
remote_author: tholbrook9
remote_url: 'https://github.com/callumalpass/tasknotes/issues/1719'
local_status: triaged
priority: high
difficulty: easy
risk: low
summary: >-
  Obsidian 1.12.x wraps .inline-title and .metadata-container in a new .mod-header.mod-ui
  element, breaking the reading mode task card injection logic which assumes .metadata-container
  is a direct child of .markdown-preview-sizer.
notes: |-
  Root cause:
  - In src/editor/TaskCardNoteDecorations.ts, the injectTaskCardInReadingMode() function
    (lines 468-480) finds .metadata-container via querySelector on .markdown-preview-sizer,
    then uses metadataContainer.nextSibling to find the insertion point. In Obsidian 1.12.x,
    .metadata-container is now inside .mod-header.mod-ui, so nextSibling is null (it's the last
    child of .mod-header). The fallback inserts as firstChild of sizer, placing the card above
    the title. Additionally, the card disappears on tab switch because reading mode re-renders
    and the injection is not re-triggered.
  - The same pattern exists in the live preview path (line 378) but works there because the
    .cm-sizer DOM structure hasn't changed.

  Suggested fix (preferred):
  - Update injectTaskCardInReadingMode() to handle the new DOM structure: after finding
    .metadata-container, check if its parent is .mod-header.mod-ui. If so, use the .mod-header
    element's nextSibling as the insertion point instead.
  - For the disappearing card on tab switch, ensure the reading mode injection is re-triggered
    on the Obsidian "active-leaf-change" or layout change events.

  Fallback options:
  - Use a more resilient insertion strategy: find .mod-header.mod-ui first, and if present,
    insert after it. Only fall back to .metadata-container logic for older Obsidian versions.
command_id: triage-issue
last_analyzed_at: '2026-03-26T00:03:00Z'
sync_state: clean
type: item_state
---
