---
id: issue-1734
provider: github
kind: issue
key: callumalpass/tasknotes#1734
external_ref: https://github.com/callumalpass/tasknotes/issues/1734
repo: callumalpass/tasknotes
number: 1734
remote_state: open
remote_title: "[Bug]: The BlockedBy Modal doesn't filter based on search text"
remote_author: "MatthewClarkeDev"
remote_url: https://github.com/callumalpass/tasknotes/issues/1734
local_status: triaged
priority: medium
difficulty: easy
risk: low
summary: "Dependency picker (BlockedBy / Blocking) shows all tasks without filtering when the user types in the search box"
notes: |
  ## Root cause / Scope
  The dependency picker uses `openTaskSelector` which creates a `TaskSelectorWithCreateModal` (extends Obsidian's `SuggestModal`). The `getSuggestions(query)` method does implement text filtering, but a regression may have broken the binding between the input field and suggestion refresh, or the `tasks` array passed to the modal contains TaskInfo objects with titles stored under a field name that differs from what the filter checks (e.g. the field mapper remapping `title`). A secondary hypothesis is that `getSuggestions` is not being called at all because a DOM-level `input` event listener override interferes with Obsidian's own suggestion pipeline.

  ## Suggested fix / Approach
  Verify that `getSuggestions` is being invoked on keypress by adding a debug log or writing a unit test. If the field mapper remaps `title`, ensure the filter in `getFilteredTasks` reads `task.title` through the canonical `TaskInfo.title` property (which should already be normalized). If the issue is the `input` listener added in `onOpen` conflicting with `SuggestModal`'s internal query handling, remove the redundant listener and rely solely on `getSuggestions`.
command_id: triage-issue
last_analyzed_at: "2026-03-31"
sync_state: clean
type: item_state
---
