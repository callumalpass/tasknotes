---
id: issue-1693
provider: github
kind: issue
key: callumalpass/tasknotes#1693
external_ref: https://github.com/callumalpass/tasknotes/issues/1693
repo: callumalpass/tasknotes
number: 1693
remote_state: open
remote_title: "[Bug]: Bang negations does not work as expected on date properties in base formulas"
remote_author: "benoitjadinon"
remote_url: https://github.com/callumalpass/tasknotes/issues/1693
local_status: triaged
priority: medium
difficulty: medium
risk: medium
summary: "Bang negation (!due, !scheduled) does not evaluate as 'is empty' on date fields in Bases formulas"
notes: |
  ## Root cause / Scope
  In Bases formula evaluation, date properties resolve to a date object (or null/undefined) rather
  than a plain falsy value. The `!` (bang) operator in formula expressions tests JavaScript truthiness,
  but a non-null date object is always truthy regardless of whether the field is semantically empty.
  Therefore `!due` never evaluates to true even when the due date is not set, because Bases may
  represent an absent date as an empty string or a special object rather than `null`/`undefined`.
  Users must use `.isEmpty()` as a workaround. This is a Bases formula engine behaviour that
  TaskNotes can either document or work around through the formula template defaults.

  ## Suggested fix / Approach
  The default urgencyScore formula in `defaultBasesFiles.ts` already uses `!${dueProperty}` which
  implies this has worked historically or was written without testing. The fix requires either:
  (1) updating the Obsidian Bases formula engine to coerce date fields to falsy when empty (upstream
  fix), or (2) updating all TaskNotes default templates to use `.isEmpty()` instead of bang negation
  on date fields. As a near-term workaround, update the shipped formula templates in
  `src/templates/defaultBasesFiles.ts` to use `.isEmpty()`, and document the limitation.
command_id: triage-issue
last_analyzed_at: "2026-03-31"
sync_state: clean
type: item_state
---
