---
id: 'github:callumalpass/tasknotes:issue:1705'
provider: github
kind: issue
key: '1705'
external_ref: callumalpass/tasknotes#1705
repo: callumalpass/tasknotes
number: 1705
remote_state: OPEN
remote_title: >-
  [FR]: Converted tasks from checkboxes should have the project property set as
  the current note
remote_author: dariuskramer
remote_url: 'https://github.com/callumalpass/tasknotes/issues/1705'
local_status: triaged
priority: medium
difficulty: easy
risk: low
summary: >-
  When converting a checkbox to a TaskNote, the newly created task file gets a
  link back to the source note, but only in a generic way. The user wants the
  source note to be set as the task's project property automatically.
notes: |-
  Root cause:
  - InstantTaskConvertService.createTaskFile() (line ~456) captures the parent note as `parentNote` using generateMarkdownLink, but this link is used for the body/details, not for the project property.
  - The projects array is populated only from parsed data (NLP/TasksPlugin) or defaults, never from the source note context.

  Suggested fix (preferred):
  - In InstantTaskConvertService.createTaskFile(), if no project is parsed from the input and the current active file is not a task file, automatically set the projects array to include a link to the current note.
  - Guard this behind a setting (e.g. "Auto-set project from source note on convert") to avoid surprising existing users.

  Fallback options:
  - Add the source note as project only when the conversion is triggered from a non-task markdown file (not from daily notes or other task files).
command_id: triage-issue
last_analyzed_at: '2026-03-22T00:00:00Z'
sync_state: clean
type: item_state
---
