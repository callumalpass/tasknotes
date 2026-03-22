---
id: 'github:callumalpass/tasknotes:issue:1644'
provider: github
kind: issue
key: '1644'
external_ref: callumalpass/tasknotes#1644
repo: callumalpass/tasknotes
number: 1644
remote_state: OPEN
remote_title: >-
  [Bug]: Default Filter on This Week View Broken for Recurring Tasks
remote_author: bkennedy-improving
remote_url: 'https://github.com/callumalpass/tasknotes/issues/1644'
local_status: triaged
priority: high
difficulty: easy
risk: low
summary: >-
  Recurring tasks without a `complete_instances` property are hidden from the
  This Week view because `!complete_instances.contains(...)` evaluates to
  undefined (falsy) when the property is absent, instead of treating absence as
  "not completed today."
notes: |-
  Root cause:
  - In `src/templates/defaultBasesFiles.ts`, all recurring task filters use the pattern `!completeInstances.contains(today().format("yyyy-MM-dd"))` without a fallback for when `complete_instances` is undefined/empty.
  - When a recurring task has never been completed, `complete_instances` is not present in the frontmatter, so the `.contains()` call on undefined returns undefined rather than true.
  - This affects the Today, This Week, Overdue, Not Blocked, and Unscheduled views -- all share the same filter pattern.

  Suggested fix (preferred):
  - Add `complete_instances.isEmpty()` as an OR clause alongside the `!complete_instances.contains(...)` check in each recurring task filter block in `defaultBasesFiles.ts`. This matches the user's suggested fix and handles the undefined case.

  Fallback options:
  - Modify the filter evaluation engine (`BasesFilterConverter` or `FilterService`) to treat `.contains()` on undefined/null as returning false (so `!undefined.contains(x)` returns true).
command_id: triage-issue
last_analyzed_at: '2026-03-22T00:00:00Z'
sync_state: clean
type: item_state
---
