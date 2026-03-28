---
id: 'github:callumalpass/tasknotes:issue:1733'
provider: github
kind: issue
key: '1733'
external_ref: callumalpass/tasknotes#1733
repo: callumalpass/tasknotes
number: 1733
remote_state: OPEN
remote_title: >-
  [FR]: preserve [[wikilinks]] in task title
remote_author: bitscorch
remote_url: 'https://github.com/callumalpass/tasknotes/issues/1733'
local_status: triaged
priority: low
difficulty: hard
risk: medium
summary: >-
  Feature request to allow [[wikilinks]] in task titles so they render as clickable links
  in views. Currently brackets are stripped by sanitizeTitleForFilename and titles are stored
  as plain text in frontmatter without wikilink rendering support.
notes: |-
  Root cause:
  - Not a bug. The sanitizeTitleForFilename method in TaskService (line 77) strips [ and ]
    characters via the regex /[<>:"/\\|?*#[\]]/g because they are invalid in filenames.
  - sanitizeTitleForStorage (line 104) does NOT strip brackets, so when storeTitleInFilename
    is false, the wikilink text is preserved in frontmatter. However, the title rendering in
    views (TaskCard, kanban, calendar, list) treats the title as plain text and does not parse
    or render embedded wikilinks.
  - The user's workarounds (description, custom fields, projects) don't surface links in
    card views, making the feature gap clear.

  Suggested fix (preferred):
  - In the TaskCard title renderer (src/ui/TaskCard.ts) and other view renderers, detect
    [[wikilink]] patterns in the title string and render them as clickable internal links
    using Obsidian's MarkdownRenderer or manual link element creation.
  - When storeTitleInFilename is true, strip wikilinks from the filename portion but preserve
    them in the frontmatter title property.
  - This requires splitting the title into segments (plain text and wikilinks) and rendering
    each appropriately.

  Fallback options:
  - Add a dedicated "linked notes" / "related notes" frontmatter array property that renders
    as clickable links on the task card, keeping the title as plain text.
  - Support wikilinks only in the task description and surface a truncated description line
    on task cards.
command_id: triage-issue
last_analyzed_at: '2026-03-29T00:00:00Z'
sync_state: clean
type: item_state
---
