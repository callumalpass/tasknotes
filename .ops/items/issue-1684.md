---
id: issue-1684
provider: github
kind: issue
key: callumalpass/tasknotes#1684
external_ref: https://github.com/callumalpass/tasknotes/issues/1684
repo: callumalpass/tasknotes
number: 1684
remote_state: open
remote_title: "[FR]: Able to use plain markdown format and have TaskNotes register the todo, as an alternative way to create task"
remote_author: "warm-july"
remote_url: https://github.com/callumalpass/tasknotes/issues/1684
local_status: triaged
priority: low
difficulty: hard
risk: medium
summary: "FR: allow TaskNotes to detect and register tasks written as plain markdown (without using the UI or API)"
notes: |
  ## Root cause / Scope
  The author wants to create tasks by writing plain markdown files (or editing YAML frontmatter directly)
  and have TaskNotes automatically detect and register them. Their motivation is that the API/MCP server
  doesn't work on Windows, so they need an alternative creation path. Currently TaskNotes registers tasks
  that have either `isTask: true` frontmatter or the configured task tag, but relies on the file being
  saved through the vault. If the file is created with the correct frontmatter, the cache should actually
  pick it up on file-change. The issue may be the user is confused about requirements (hidden task ID,
  required tag/property) rather than a code deficiency. However, supporting more permissive detection
  or providing clearer documentation would help.

  ## Suggested fix / Approach
  Clarify that plain markdown files with `isTask: true` (or the configured property/tag) are already
  supported if created in the vault folder. Documentation and a "plain markdown format" guide for
  external tool use would address the core request. If a richer FR is desired, consider an optional
  "watch folder" feature that auto-sets the task identification property on new files added to designated
  folders.
command_id: triage-issue
last_analyzed_at: "2026-03-31"
sync_state: clean
type: item_state
---
