---
id: issue-1642
provider: github
kind: issue
key: callumalpass/tasknotes#1642
external_ref: https://github.com/callumalpass/tasknotes/issues/1642
repo: callumalpass/tasknotes
number: 1642
remote_state: open
remote_title: "[FR]: monthly/yearly without without specifying a day"
remote_author: "Volker-brdb"
remote_url: https://github.com/callumalpass/tasknotes/issues/1642
local_status: triaged
priority: low
difficulty: medium
risk: medium
summary: "Feature request: allow monthly/yearly recurrence in flexible-schedule mode without requiring a day-of-month/year selection"
notes: |
  ## Root cause / Scope
  The recurrence UI forces users to pick a specific day-of-month when choosing monthly or yearly recurrence, even when using the "recur from completion date" flexible mode. For flexible recurrence, the exact day should not need to be fixed in advance — the next occurrence should be calculated relative to the completion date. Weekly recurrence already works without pinning a weekday (it defaults to the current day). Monthly and yearly recurrence rules in the RRULE spec can omit BYMONTHDAY/BYMONTH when used in conjunction with flexible scheduling, but the current `RecurrenceContextMenu.ts` validator requires the day fields.

  ## Suggested fix / Approach
  When recurrence mode is "flexible" (recur from completion), allow saving the recurrence rule without BYMONTHDAY for monthly and without BYMONTHDAY+BYMONTH for yearly. The rrule generator (`rruleConverter.ts`) should compute the anchor day at completion time rather than storing it statically. This requires updating validation logic in `RecurrenceContextMenu.ts` and adjusting `rruleConverter.ts` to handle missing day fields in flexible mode.
command_id: triage-issue
last_analyzed_at: "2026-03-31"
sync_state: clean
type: item_state
---
