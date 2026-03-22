---
id: 'github:callumalpass/tasknotes:issue:1657'
provider: github
kind: issue
key: '1657'
external_ref: callumalpass/tasknotes#1657
repo: callumalpass/tasknotes
number: 1657
remote_state: OPEN
remote_title: >-
  [Bug]: "+ New" button on Kanban view doesn't assign new task to current project
remote_author: casualQuads122
remote_url: 'https://github.com/callumalpass/tasknotes/issues/1657'
local_status: triaged
priority: medium
difficulty: easy
risk: low
summary: >-
  When creating a task via the "+ New" button in a Kanban view filtered to a specific project, the
  new task is not pre-populated with that project, because the Bases createFileForView() method
  does not pass the current view's filter context (project) as a pre-populated value.
notes: |-
  Root cause:
  - In src/bases/BasesViewBase.ts, createFileForView() extracts pre-populated values from the
    frontmatterProcessor callback provided by Bases. This callback sets defaults based on the
    view's groupBy column value. However, filter conditions (like "project = X") are not passed
    through to the frontmatterProcessor, so when a Kanban view is filtered by project, the
    "+ New" button opens the task creation modal without the project field pre-populated.

  Suggested fix (preferred):
  - In createFileForView(), also extract the active filter conditions from the Bases query and
    map any single-value equality filters (e.g. "projects = MyProject") to prePopulatedValues.
    This ensures the new task inherits the view's filter context.

  Fallback options:
  - Pass the project context from the Kanban column header or swimlane context into the
    frontmatterProcessor before calling createFileForView().
command_id: triage-issue
last_analyzed_at: '2026-03-22T00:00:00Z'
sync_state: clean
type: item_state
---
