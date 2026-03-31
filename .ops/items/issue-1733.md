---
id: issue-1733
provider: github
kind: issue
key: callumalpass/tasknotes#1733
external_ref: https://github.com/callumalpass/tasknotes/issues/1733
repo: callumalpass/tasknotes
number: 1733
remote_state: open
remote_title: "[FR]: preserve [[wikilinks]] in task title"
remote_author: "bitscorch"
remote_url: https://github.com/callumalpass/tasknotes/issues/1733
local_status: triaged
priority: low
difficulty: hard
risk: medium
summary: "Feature request to allow wikilinks in task titles that are preserved in frontmatter and rendered as clickable links in all views"
notes: |
  ## Root cause / Scope
  Task titles are stored in YAML frontmatter and rendered as plain strings throughout all card views (kanban, calendar, list). Supporting wikilinks in titles requires: (1) allowing `[[...]]` syntax in the title input without stripping it, (2) storing the raw wikilink string in the YAML `title` field, (3) rendering titles with link parsing in every view that renders task cards. This touches `TaskCreationModal`, `TaskEditModal`, the `TaskCard` render path, and every place title text is displayed. The complexity is further amplified by the need to handle partial link syntax and ensure Obsidian's graph and backlink features resolve the embedded links.

  ## Suggested fix / Approach
  Phase the work: first stop stripping `[[...]]` from the title input on save; then add a title-rendering utility that replaces `[[target|alias]]` tokens with anchor elements using `app.workspace.openLinkText`; apply it wherever titles are rendered in task cards. Add a setting to opt-in since it changes existing data behavior.
command_id: triage-issue
last_analyzed_at: "2026-03-31"
sync_state: clean
type: item_state
---
