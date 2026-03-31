---
id: issue-1722
provider: github
kind: issue
key: callumalpass/tasknotes#1722
external_ref: https://github.com/callumalpass/tasknotes/issues/1722
repo: callumalpass/tasknotes
number: 1722
remote_state: open
remote_title: "[Bug]: Inline task conversion created duplicates in Kanban view until a refresh is done."
remote_author: "literallydope"
remote_url: https://github.com/callumalpass/tasknotes/issues/1722
local_status: triaged
priority: medium
difficulty: medium
risk: medium
summary: "Converting an inline Markdown task to a tasknote shows a duplicate entry in the Kanban view until the view is closed and reopened"
notes: |
  ## Root cause / Scope
  When InstantTaskConvertService (src/services/InstantTaskConvertService.ts) converts an inline task it: (1) creates a new task file, (2) replaces the source line with a wikilink, and (3) calls forceMetadataCacheUpdate then dispatchTaskUpdate via refreshTaskLinkOverlays. The Kanban view likely reacts to both the original inline-task entry (still momentarily present in the cache or emitted via a file-change event) and the newly created task file, resulting in both appearing until a full view refresh clears the stale entry. The race between the line replacement completing and the metadata cache invalidating the old inline task record allows two cards to coexist briefly.

  ## Suggested fix / Approach
  After the inline-to-tasknote conversion, emit a specific event (or use an existing task-updated event) that signals the old inline task path has been superseded, so Kanban view consumers can remove the stale card before the new one is rendered. Alternatively, ensure the Kanban view debounces its refresh and waits for the full conversion to settle (file written + cache updated) before re-rendering. The fix touches InstantTaskConvertService.ts and likely the Kanban view's event subscription in src/bases/KanbanView.ts.
command_id: triage-issue
last_analyzed_at: "2026-03-31"
sync_state: clean
type: item_state
---
