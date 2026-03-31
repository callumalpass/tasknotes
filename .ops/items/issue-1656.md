---
id: issue-1656
provider: github
kind: issue
key: callumalpass/tasknotes#1656
external_ref: https://github.com/callumalpass/tasknotes/issues/1656
repo: callumalpass/tasknotes
number: 1656
remote_state: open
remote_title: "[FR]: Updating of the properties' keys"
remote_author: "SKIERZZ"
remote_url: https://github.com/callumalpass/tasknotes/issues/1656
local_status: triaged
priority: low
difficulty: hard
risk: high
summary: "Feature request: when renaming a property key in settings, automatically migrate all existing task files to use the new key name"
notes: |
  ## Root cause / Scope
  When users rename a property key in the TaskNotes settings (e.g., rename `due` to `deadline`), existing task notes continue to use the old frontmatter key. The plugin supports custom field names via `FieldMapper`, but there is no migration step that renames the YAML keys in existing notes. This is a common friction point for users who want to standardize their property names.

  ## Suggested fix / Approach
  Implement a bulk migration command that: (1) reads the old and new field key mapping from settings; (2) iterates over all task files in the vault; (3) renames the frontmatter key in each file using the Obsidian `FileManager.processFrontMatter` API. This is a high-risk operation (bulk write to all task files) that should be gated behind a confirmation dialog and ideally offer a dry-run preview. Consider as a dedicated "Migrate property keys" button in settings rather than an automatic on-rename action.
command_id: triage-issue
last_analyzed_at: "2026-03-31"
sync_state: clean
type: item_state
---
