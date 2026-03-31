---
id: issue-1641
provider: github
kind: issue
key: callumalpass/tasknotes#1641
external_ref: https://github.com/callumalpass/tasknotes/issues/1641
repo: callumalpass/tasknotes
number: 1641
remote_state: open
remote_title: "[FR]: Multiple property based event times"
remote_author: "jhoogeboom"
remote_url: https://github.com/callumalpass/tasknotes/issues/1641
local_status: triaged
priority: low
difficulty: hard
risk: medium
summary: "Feature request to allow multiple start/end date property values per task to generate multiple calendar entries"
notes: |
  ## Root cause / Scope
  Currently each task maps to a single calendar event derived from a single `scheduled` (start) and optional `due` (end) date. The requester wants a task to produce multiple discrete calendar events — each with its own start/end pair — for use cases like recurring appointment scheduling. This is a significant data-model extension: the calendar event generator in `calendar-core.ts` would need to iterate over a list-of-dates property rather than a scalar, and the frontmatter schema / UI would need to support lists of datetime values.

  ## Suggested fix / Approach
  Consider a new optional frontmatter property (e.g., `event_times: [{start, end}, ...]`) that the calendar event generator checks. If present, it expands the task into N events instead of one. This requires changes to: the type definitions, `calendar-core.ts` event generation, task card display, and possibly the task creation/edit modal. Scope is large; a lighter alternative would be to document using separate ICS subscription or time-entry blocks for the described use case.
command_id: triage-issue
last_analyzed_at: "2026-03-31"
sync_state: clean
type: item_state
---
