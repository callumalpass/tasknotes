---
id: issue-1720
provider: github
kind: issue
key: callumalpass/tasknotes#1720
external_ref: https://github.com/callumalpass/tasknotes/issues/1720
repo: callumalpass/tasknotes
number: 1720
remote_state: open
remote_title: "[Bug]: tasknotesTaskList renders date-like Bases values as icon names (e.g. ) and ignores property display names"
remote_author: "Sirnii"
remote_url: https://github.com/callumalpass/tasknotes/issues/1720
local_status: triaged
priority: medium
difficulty: medium
risk: medium
summary: "Date-type and formula properties in tasknotesTaskList Bases views render as the Lucide icon name (e.g. 'clock') instead of the human-readable value, and property labels show the raw id instead of the configured display name"
notes: |
  ## Root cause / Scope
  In src/ui/taskCardPresentation.ts, extractBasesValue() handles Bases value objects that carry an `icon` field. The function checks `display` first, then `date`, then `data`, and finally falls back to stripping the "lucide-" prefix from `icon`. For date/datetime Bases values the icon is "lucide-clock" (rendered as "clock"). The bug occurs when `display` is null/undefined and `date` is also null — for example when Bases returns a relative formula value object where the relative string is in `display` but the object lacks a `data` field, or when the Bases API for date properties uses a different structure than expected. The fallback then emits the icon name. The label issue is in src/ui/taskCardHelpers.ts / resolveTaskCardPropertyLabel: it receives the raw property id but Bases-configured display names are not passed through the propertyLabels override map, so they fall through to the auto-capitalize default.

  ## Suggested fix / Approach
  In extractBasesValue, add handling for objects where icon is "lucide-clock" (or any date icon): prefer `display` (which may hold the formatted relative string), then `date`, then `data`. For the label issue, when the tasknotesTaskList view is constructed from a Bases context, populate the propertyLabels map from the Bases column/formula display name metadata so that resolveTaskCardPropertyLabel returns the configured name rather than the raw id.
command_id: triage-issue
last_analyzed_at: "2026-03-31"
sync_state: clean
type: item_state
---
