---
id: issue-1719
provider: github
kind: issue
key: callumalpass/tasknotes#1719
external_ref: https://github.com/callumalpass/tasknotes/issues/1719
repo: callumalpass/tasknotes
number: 1719
remote_state: open
remote_title: "[Bug]: Inline task card mispositioned in reading mode on Obsidian 1.12.x"
remote_author: "tholbrook9"
remote_url: https://github.com/callumalpass/tasknotes/issues/1719
local_status: triaged
priority: high
difficulty: easy
risk: low
summary: "In Obsidian 1.12.x, the inline task card renders above the title and properties in reading mode because .metadata-container is no longer a direct child of .markdown-preview-sizer"
notes: |
  ## Root cause / Scope
  Obsidian 1.12.x restructured the reading mode DOM by wrapping .inline-title and .metadata-container inside a new .mod-header.mod-ui element inside .markdown-preview-sizer. The injection logic in src/editor/TaskCardNoteDecorations.ts (injectReadingModeWidget, ~line 485) queries sizer.querySelector('.metadata-container') and then calls sizer.insertBefore(widget, metadataContainer.nextSibling). Because .metadata-container is now a child of .mod-header (not a direct child of .sizer), metadataContainer.nextSibling is null (last child of .mod-header), so the fallback inserts the widget as the first child of .sizer — above .mod-header, above title and properties. The same structural assumption is also present in the RelationshipsDecorations reading-mode path (~line 518).

  ## Suggested fix / Approach
  After locating .metadata-container via querySelector, check whether its parentElement is the sizer. If not (Obsidian 1.12.x case), use metadataContainer.closest('.mod-header, .markdown-preview-sizer') or simply insert after the .mod-header element itself: sizer.insertBefore(widget, modHeader.nextSibling). A defensive approach is to walk up from .metadata-container to find the direct child of .sizer and insert after that element. Apply the same fix to both TaskCardNoteDecorations.ts and RelationshipsDecorations.ts reading mode paths.
command_id: triage-issue
last_analyzed_at: "2026-03-31"
sync_state: clean
type: item_state
---
