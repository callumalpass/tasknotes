---
id: 'github:callumalpass/tasknotes:issue:1668'
provider: github
kind: issue
key: '1668'
external_ref: callumalpass/tasknotes#1668
repo: callumalpass/tasknotes
number: 1668
remote_state: OPEN
remote_title: >-
  [Bug]: NLP trigger not working for additional properties
remote_author: hokfujow
remote_url: 'https://github.com/callumalpass/tasknotes/issues/1668'
local_status: triaged
priority: medium
difficulty: medium
risk: low
summary: >-
  Custom user-defined properties with trigger characters (e.g. & for system, ^ for use case) are
  recognized in the task title preview chips but not populated into the form when the magic wand
  (NLP auto-populate) button is clicked.
notes: |-
  Root cause:
  - The NaturalLanguageParser (src/services/NaturalLanguageParser.ts) extends
    NaturalLanguageParserCore from tasknotes-nlp-core and receives userFields. Parsing extracts
    trigger-prefixed values into parsed.userFields. However, in the modal that handles the magic
    wand action (src/modals/TaskSelectorWithCreateModal.ts lines ~258-261), the code iterates
    parsed.userFields and finds the field definition, but there may be a mismatch between how the
    parsed values are keyed (by field id) versus how the form fields expect them (by field key),
    or the auto-populate path in TaskCreationModal may not read from parsed.userFields at all.

  Suggested fix (preferred):
  - Trace the magic wand handler in TaskCreationModal/TaskSelectorWithCreateModal to ensure
    parsed.userFields entries are correctly mapped to form field values. Verify the field
    lookup uses the correct identifier (id vs key) matching the userField definition.

  Fallback options:
  - Add explicit logging in the NLP -> form population path to identify where user field values
    are dropped.
command_id: triage-issue
last_analyzed_at: '2026-03-22T00:00:00Z'
sync_state: clean
type: item_state
---
