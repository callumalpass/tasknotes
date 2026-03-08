---
id: 'github:callumalpass/tasknotes:issue:1684'
provider: github
kind: issue
key: '1684'
external_ref: callumalpass/tasknotes#1684
repo: callumalpass/tasknotes
number: 1684
remote_state: OPEN
remote_title: >-
  [FR]: Able to use plain markdown format and have TaskNotes register the todo,
  as an alternative way to create task
remote_author: warm-july
remote_url: 'https://github.com/callumalpass/tasknotes/issues/1684'
remote_updated_at: '2026-03-07T23:49:13Z'
last_seen_remote_updated_at: '2026-03-07T23:49:13Z'
local_status: triaged
priority: medium
difficulty: hard
risk: medium
summary: >-
  No hidden task ID is required. Task discovery is frontmatter-driven:
  `TaskManager` only registers markdown files whose YAML frontmatter matches
  the configured tag or property, while raw `- [ ]` checklist items are only
  handled by the separate inline conversion flow.
notes: |-
  Root cause:
  - `src/utils/TaskManager.ts` discovers tasks exclusively through `isTaskFile(frontmatter)` and never inspects markdown body content.
  - In tag mode, identification checks `frontmatter.tags` only; plain markdown checkboxes and body tags are ignored.
  - The plugin's task `id` is just the file path (`TaskManager.extractTaskInfoFromNative`), so there is no hidden per-task identifier to generate.

  Suggested fix (preferred):
  - Add an explicit plain-markdown import/convert workflow that reuses `InstantTaskConvertService` to turn raw checklists or list items into real TaskNotes files. This preserves the existing file-based task model and avoids introducing synthetic inline-task IDs across views, dependencies, reminders, and time tracking.

  Fallback options:
  - Document the minimum manual-creation contract clearly: a markdown file is recognized when its frontmatter matches the current task-identification settings, with no hidden ID required.
  - For agent workflows, steer users toward `mdbase-tasknotes` or a generated task template so external tools can write valid frontmatter directly.
command_id: triage-issue
last_analyzed_at: '2026-03-08T03:53:31Z'
sync_state: clean
type: item_state
---
