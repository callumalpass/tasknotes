---
id: issue-1651
provider: github
kind: issue
key: callumalpass/tasknotes#1651
external_ref: https://github.com/callumalpass/tasknotes/issues/1651
repo: callumalpass/tasknotes
number: 1651
remote_state: open
remote_title: "[Bug]: Query API 'is' operator does not match scheduled dates with time components"
remote_author: "36mimu36"
remote_url: https://github.com/callumalpass/tasknotes/issues/1651
local_status: triaged
priority: medium
difficulty: easy
risk: low
summary: "API/MCP query with 'is' operator on date fields fails to match datetime values like '2026-02-27T09:00' against date-only condition '2026-02-27'"
notes: |
  ## Root cause / Scope
  `FilterUtils.isEqual()` (line 448) routes date fields to `isEqualDate()` only when `property` is passed and `isDateProperty(property)` returns true AND `(taskValue || isNaturalLanguageDate(conditionValue))` is truthy. The `isEqualDate()` function correctly calls `getDatePart()` on both sides, which strips the time component. However the condition `(taskValue || isNaturalLanguageDate(conditionValue))` will evaluate to false when `taskValue` is an empty string. More critically for `is_not_empty`: the `isEmpty()` function checks if the value is null/undefined/empty-string, but datetime strings like `"2026-02-27T09:00"` are non-empty strings, so `is-not-empty` should return true. The reporter's claim that `is_not_empty` returns 0 results may indicate a different code path where `property` is not properly passed as `FilterProperty`, falling through to exact string equality rather than date-aware comparison. The API query uses `FilterService.getGroupedTasks()` → `evaluateCondition()` → `applyOperator()` with `property as FilterProperty` — this should work. The bug may be version-specific or interact with how the query body maps `"scheduled"` to the internal `FilterProperty` type.

  ## Suggested fix / Approach
  Verify that the `property` field in the API query body is accepted as a valid `FilterProperty` value (the type enum should include `"scheduled"`). If the type narrowing fails silently, the date-aware comparison path is skipped and exact string equality is used instead — which would explain the mismatch between `"2026-02-27"` and `"2026-02-27T09:00"`. A defensive fix: in `isEqual()`, when the property is not explicitly recognized as a date property but both values look like date strings, still use `getDatePart()` comparison.
command_id: triage-issue
last_analyzed_at: "2026-03-31"
sync_state: clean
type: item_state
---
