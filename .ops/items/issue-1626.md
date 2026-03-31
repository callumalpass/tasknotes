---
id: issue-1626
provider: github
kind: issue
key: callumalpass/tasknotes#1626
external_ref: https://github.com/callumalpass/tasknotes/issues/1626
repo: callumalpass/tasknotes
number: 1626
remote_state: open
remote_title: "[Bug]: ICS subscription recurring events truncated by maxInstances=100 cap"
remote_author: "pib"
remote_url: https://github.com/callumalpass/tasknotes/issues/1626
local_status: triaged
priority: medium
difficulty: easy
risk: low
summary: "ICSSubscriptionService caps recurring event expansion at 100 instances, silently truncating high-frequency events before the 1-year window"
notes: |
  ## Root cause / Scope
  In `src/services/ICSSubscriptionService.ts` at line 432, `const maxInstances = 100` acts as a hard upper bound on the `while` loop that expands recurring events. For a 3×/week event, 100 instances is reached in roughly 33 weeks — well before the `maxDate` of 1 year. The `maxDate` guard at line 435 already breaks the loop for pathological open-ended recurrences, so `maxInstances` is redundant and too low for common weekly+ patterns.

  ## Suggested fix / Approach
  Raise `maxInstances` to a much higher value (e.g., 1500, which safely covers a daily event for 4 years) or remove it entirely and rely solely on the `maxDate` guard. Alternatively, compute a dynamic bound: `Math.ceil(daysInWindow * maxDailyFrequency)` where `maxDailyFrequency` defaults to 10. Add a comment explaining that `maxDate` is the primary guard against infinite loops for well-formed RRULE strings.
command_id: triage-issue
last_analyzed_at: "2026-03-31"
sync_state: clean
type: item_state
---
