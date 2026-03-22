---
id: 'github:callumalpass/tasknotes:issue:1615'
provider: github
kind: issue
key: '1615'
external_ref: callumalpass/tasknotes#1615
repo: callumalpass/tasknotes
number: 1615
remote_state: OPEN
remote_title: >-
  [Bug]: Kanban: custom multi-text properties not detected as list (metadataTypeManager uses .widget not .type)
remote_author: konton71
remote_url: 'https://github.com/callumalpass/tasknotes/issues/1615'
local_status: triaged
priority: medium
difficulty: trivial
risk: low
summary: >-
  Kanban view fails to detect custom multitext properties as list types because
  isListTypeProperty() checks propertyInfo.type but Obsidian exposes the field
  as propertyInfo.widget.
notes: |-
  Root cause:
  - In src/bases/KanbanView.ts line ~442-445, isListTypeProperty() reads
    propertyInfo.type to check if a property is multitext/tags/aliases.
    However, Obsidian's metadataTypeManager exposes the type info as
    propertyInfo.widget, not propertyInfo.type.
  - This means custom user-defined multitext properties are never recognized
    as list properties, so "Show items in multiple columns" never triggers
    for them. Only built-in properties (contexts, projects, tags, aliases)
    work via the hardcoded fallback set on lines 456-463.

  Suggested fix (preferred):
  - Check both propertyInfo.type and propertyInfo.widget in
    isListTypeProperty() for maximum compatibility across Obsidian versions:
    `const propType = propertyInfo.type || propertyInfo.widget;`
    `if (propType && listTypes.has(propType)) { return true; }`

  Fallback options:
  - Check only propertyInfo.widget if .type is confirmed to not exist in
    any supported Obsidian version.
command_id: triage-issue
last_analyzed_at: '2026-03-22T00:00:00Z'
sync_state: clean
type: item_state
---
