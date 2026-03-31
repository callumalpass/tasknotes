---
id: issue-1705
provider: github
kind: issue
key: callumalpass/tasknotes#1705
external_ref: https://github.com/callumalpass/tasknotes/issues/1705
repo: callumalpass/tasknotes
number: 1705
remote_state: open
remote_title: "[FR]: Converted tasks from checkboxes should have the project property set as the current note"
remote_author: "dariuskramer"
remote_url: https://github.com/callumalpass/tasknotes/issues/1705
local_status: triaged
priority: low
difficulty: easy
risk: low
summary: "FR: when converting a checkbox to a task, automatically set the 'project' property to the source note"
notes: |
  ## Root cause / Scope
  Currently `InstantTaskConvertService` creates a backlink from the source note to the new task file
  but does not set the `project` property on the new task. The `project` field would allow
  bi-directional linking. The parsed task data does support a `projects` array, but the source note
  path is not injected into that array during inline conversion.

  ## Suggested fix / Approach
  In `InstantTaskConvertService.createTaskFile()` (or `buildTaskCreationDataFromParsed()`), if no
  project has been parsed from the task text, add the current note's path (formatted as a wiki-link)
  to the `projects` array. This should be opt-in via a setting (e.g., "Auto-set project on
  conversion") to avoid unexpected behaviour for users who don't use the project field. The change
  is isolated to the conversion code path.
command_id: triage-issue
last_analyzed_at: "2026-03-31"
sync_state: clean
type: item_state
---
