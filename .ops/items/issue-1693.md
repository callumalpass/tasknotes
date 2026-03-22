---
id: 'github:callumalpass/tasknotes:issue:1693'
provider: github
kind: issue
key: '1693'
external_ref: callumalpass/tasknotes#1693
repo: callumalpass/tasknotes
number: 1693
remote_state: OPEN
remote_title: >-
  [Bug]: Bang negations does not work as expected on date properties in base formulas
remote_author: benoitjadinon
remote_url: 'https://github.com/callumalpass/tasknotes/issues/1693'
local_status: triaged
priority: medium
difficulty: medium
risk: low
summary: >-
  The bang (!) negation operator in Bases formula expressions does not work
  correctly on date properties. Using !due or !scheduled does not produce a
  truthy value when the date is empty/null; users must use .isEmpty() instead.
notes: |-
  Root cause:
  - The Bases formula evaluator (part of the Obsidian Bases API, not directly
    in TaskNotes source) likely treats date property references as objects
    rather than simple values. The ! operator checks JavaScript truthiness,
    and a date property reference may return an empty object or wrapper
    rather than null/undefined, making !due always falsy regardless of
    whether a date is set. The .isEmpty() method is a Bases-specific API
    that correctly checks the underlying value.
  - This may be a Bases API limitation rather than a TaskNotes bug, since
    formula evaluation is handled by Obsidian's Bases engine. However,
    TaskNotes controls how property values are provided to the Bases data
    layer via BasesDataAdapter.

  Suggested fix (preferred):
  - Investigate how TaskNotes provides date property values to the Bases
    data adapter (src/bases/BasesDataAdapter.ts). Ensure null/undefined
    dates are passed as null rather than empty strings or wrapper objects,
    so JavaScript truthiness checks work as expected.

  Fallback options:
  - Document that .isEmpty() should be used instead of bang negation for
    date properties in formulas, if this is a Bases API limitation outside
    TaskNotes control.
command_id: triage-issue
last_analyzed_at: '2026-03-22T00:00:00Z'
sync_state: clean
type: item_state
---
