---
id: issue-1644
provider: github
kind: issue
key: callumalpass/tasknotes#1644
external_ref: https://github.com/callumalpass/tasknotes/issues/1644
repo: callumalpass/tasknotes
number: 1644
remote_state: open
remote_title: "[Bug]: Default Filter on This Week View Broken for Recurring Tasks"
remote_author: "bkennedy-improving"
remote_url: https://github.com/callumalpass/tasknotes/issues/1644
local_status: triaged
priority: medium
difficulty: easy
risk: low
summary: "Default 'This Week' base filter excludes recurring tasks that have never been completed because complete_instances is undefined rather than empty"
notes: |
  ## Root cause / Scope
  The default `tasks-default.base` filter for recurring tasks uses `!complete_instances.contains(today().format("yyyy-MM-dd"))`. When a task has never had a completion recorded, the `complete_instances` frontmatter property is absent entirely. The Bases query engine evaluates `.contains()` on `undefined` as a falsy/error path rather than treating it as an empty list, causing the NOT condition to evaluate to false instead of true. This means new recurring tasks with no `complete_instances` key are incorrectly hidden from the This Week view.

  ## Suggested fix / Approach
  The fix is a one-line addition to the default base file filter: add `- complete_instances.isEmpty()` as an OR clause alongside the `!complete_instances.contains(...)` condition. The issue author has already identified the exact change needed. The default `tasks-default.base` template shipped with the plugin should be updated. Optionally, the plugin could also auto-populate `complete_instances: []` when creating new recurring tasks to prevent the missing-key problem entirely.
command_id: triage-issue
last_analyzed_at: "2026-03-31"
sync_state: clean
type: item_state
---
