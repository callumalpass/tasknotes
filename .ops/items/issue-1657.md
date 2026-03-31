---
id: issue-1657
provider: github
kind: issue
key: callumalpass/tasknotes#1657
external_ref: https://github.com/callumalpass/tasknotes/issues/1657
repo: callumalpass/tasknotes
number: 1657
remote_state: open
remote_title: "[Bug]: \"+ New\" button on Kanban view doesn't assign new task to current project"
remote_author: "casualQuads122"
remote_url: https://github.com/callumalpass/tasknotes/issues/1657
local_status: triaged
priority: medium
difficulty: medium
risk: medium
summary: "New task created from Kanban + New button does not inherit the project context from the current Bases Kanban view"
notes: |
  ## Root cause / Scope
  `BasesViewBase.createFileForView()` is the override that intercepts the Bases "+ New" button. It extracts pre-populated values from a `frontmatterProcessor` callback provided by Bases. The code comment at line 353 notes: "As of the current implementation, Bases (still in beta) may not yet call this method." and "When Obsidian 1.10.2 is released and Bases supports it, this will work automatically." If Bases does call the `frontmatterProcessor` but only provides generic defaults (not the current project filter context), the project field will not be populated. The Bases Kanban view knows which project is being filtered (it's embedded in a project note), but this context is not automatically passed through to the `frontmatterProcessor` — Bases would need to explicitly set `projects` in the frontmatter defaults based on the view's filter state.

  ## Suggested fix / Approach
  Two paths: (1) If Bases supports passing filter context through `frontmatterProcessor`, ensure the `projects` field is included — this would require Bases API changes. (2) Implement a workaround in `createFileForView()`: detect whether the view is embedded in a project note (via `this.sourcePath` or similar context) and pre-populate `projects` with the embedding note's path. This requires reading the parent note context, which may be available via the Bases view's embed context.
command_id: triage-issue
last_analyzed_at: "2026-03-31"
sync_state: clean
type: item_state
---
