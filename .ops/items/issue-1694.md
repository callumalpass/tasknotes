---
id: issue-1694
provider: github
kind: issue
key: callumalpass/tasknotes#1694
external_ref: https://github.com/callumalpass/tasknotes/issues/1694
repo: callumalpass/tasknotes
number: 1694
remote_state: open
remote_title: "[Bug]: Enabling taskNotes on iPad causes back arrow to freeze Obsidian on my most frequently used file"
remote_author: "wealthychef1"
remote_url: https://github.com/callumalpass/tasknotes/issues/1694
local_status: triaged
priority: high
difficulty: hard
risk: high
summary: "Obsidian hangs on iPad when using the native back arrow after navigating from a Bases view file with TaskNotes enabled"
notes: |
  ## Root cause / Scope
  The bug is highly specific: a file containing Bases views with task lists causes Obsidian to hang
  when the iOS/iPadOS native back arrow (top-left) is used to navigate back. The virtual keyboard
  back arrow works fine. This points to a difference in how the two navigation mechanisms interact
  with Obsidian's workspace history and leaf lifecycle. TaskNotes registers `active-leaf-change`
  listeners in `pluginBootstrap.ts` and `TaskCardNoteDecorations.ts`/`RelationshipsDecorations.ts`.
  On leaf change, these handlers call `scheduleInjection()` which manipulates the reading-mode DOM.
  On iPad, the native back button may trigger a different navigation code path that interacts with
  TaskNotes' DOM manipulation or async injection scheduler in a way that causes a deadlock or
  infinite loop. The specificity to one file with many Bases views suggests that the DOM injection
  work (iterating all leaves, querying `.markdown-preview-sizer`, inserting task card widgets) is
  expensive for that particular file and may block the main thread.

  ## Suggested fix / Approach
  Add an early-exit guard in `scheduleInjection` / `injectReadingModeWidget` that detects iOS and
  reduces or defers injection work. Profile the specific file to identify if a large number of task
  card widgets causes O(n) DOM operations on navigation. Consider debouncing the `active-leaf-change`
  handler more aggressively on mobile. A short-term mitigation is to check if the leaf is still
  current before performing injection. Long-term, the injection scheduler should have a maximum
  concurrent injection limit to avoid saturating the main thread on mobile.
command_id: triage-issue
last_analyzed_at: "2026-03-31"
sync_state: clean
type: item_state
---
