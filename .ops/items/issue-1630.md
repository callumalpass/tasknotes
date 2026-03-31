---
id: issue-1630
provider: github
kind: issue
key: callumalpass/tasknotes#1630
external_ref: https://github.com/callumalpass/tasknotes/issues/1630
repo: callumalpass/tasknotes
number: 1630
remote_state: open
remote_title: "[Bug]: Task cards do not respect \"Readable line length\" when using Minimal theme"
remote_author: "martin-forge"
remote_url: https://github.com/callumalpass/tasknotes/issues/1630
local_status: triaged
priority: low
difficulty: easy
risk: low
summary: "Task card container uses full editor width and does not inherit the Minimal theme's readable line-length constraint"
notes: |
  ## Root cause / Scope
  Obsidian's "Readable line length" setting constrains the `.cm-content` / `.markdown-preview-view` content column. The TaskNotes task card container element (`.tasknotes-plugin .task-card` or its wrapper) is positioned or sized in a way that escapes this constraint — likely because it uses `width: 100%` relative to the editor pane rather than inheriting the inline content flow. The Minimal theme applies its column width via `--file-line-width` CSS variable on `.markdown-source-view .cm-content`, but the plugin's card container may be rendered as a block element that stretches to the full leaf width.

  ## Suggested fix / Approach
  In the relevant CSS (likely `styles/task-card-bem.css` or `styles/base.css`), ensure the task card container does not override `max-width` and flows within the normal inline content column. Alternatively add `max-width: var(--file-line-width, 100%)` to the outermost task card wrapper. Test with the Minimal theme and "Readable line length" enabled.
command_id: triage-issue
last_analyzed_at: "2026-03-31"
sync_state: clean
type: item_state
---
