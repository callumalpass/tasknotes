---
id: issue-1628
provider: github
kind: issue
key: callumalpass/tasknotes#1628
external_ref: https://github.com/callumalpass/tasknotes/issues/1628
repo: callumalpass/tasknotes
number: 1628
remote_state: open
remote_title: "[Bug]: Tasks disappear"
remote_author: "Lanalangz"
remote_url: https://github.com/callumalpass/tasknotes/issues/1628
local_status: triaged
priority: high
difficulty: medium
risk: high
summary: "Switching between custom agenda views causes non-recurring tasks to disappear until the pane is closed and reopened"
notes: |
  ## Root cause / Scope
  The reporter has two custom views (one showing only due tasks, one only scheduled tasks). After navigating default → custom-view-A → custom-view-B, non-recurring tasks vanish from all views. The state persists even when navigating back to the default view; only a full pane close/reopen recovers them. This strongly suggests that the task list or filter state is mutated or drained after the second custom view activates — likely a shared reference being filtered destructively rather than producing a new filtered array, or a saved-view filter accumulating extra exclusion criteria across switches. Recurring tasks are exempt, pointing to special-casing in the filter path.

  ## Suggested fix / Approach
  Audit the view-switching path in `FilterService.ts` and any agenda/bases view code that maintains a task list reference. Ensure filter operations produce new arrays (avoid `splice` / in-place mutation on the shared task cache). Add a regression test that applies two successive filter presets to the same task set and verifies both arrays remain complete.
command_id: triage-issue
last_analyzed_at: "2026-03-31"
sync_state: clean
type: item_state
---
