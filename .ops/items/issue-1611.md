---
id: 'github:callumalpass/tasknotes:issue:1611'
provider: github
kind: issue
key: '1611'
external_ref: callumalpass/tasknotes#1611
repo: callumalpass/tasknotes
number: 1611
remote_state: OPEN
remote_title: >-
  [Bug]: formula.urgencyScore not working as expected
remote_author: benoitjadinon
remote_url: 'https://github.com/callumalpass/tasknotes/issues/1611'
local_status: triaged
priority: medium
difficulty: trivial
risk: low
summary: >-
  The formula.urgencyScore returns null when formula.daysUntilNext evaluates to
  null, causing max() to propagate the null value and breaking sort ordering in
  all default base views.
notes: |-
  Root cause:
  - In src/templates/defaultBasesFiles.ts, daysUntilDue and daysUntilScheduled
    return null when the respective date is not set. The daysUntilNext formula
    can propagate null when edge cases arise (e.g., date property is truthy but
    date parsing fails, or min() receives a null operand).
  - urgencyScore uses max(0, 10 - formula.daysUntilNext) which returns null
    when daysUntilNext is null, since arithmetic with null propagates null.
  - This breaks sorting in all default base views (Inbox, Today, Overdue,
    This Week) that sort by formula.urgencyScore.

  Suggested fix (preferred):
  - Wrap daysUntilNext in a null-safe fallback in the urgencyScore formula:
    `if(!due && !scheduled, formula.priorityWeight, formula.priorityWeight + max(0, 10 - if(formula.daysUntilNext, formula.daysUntilNext, 0)))`
  - This matches the fix suggested by the reporter.

  Fallback options:
  - Fix daysUntilNext itself to never return null by defaulting to 0:
    replace the null returns in daysUntilDue/daysUntilScheduled with 0.
    However, null has semantic meaning (no date) so this is less clean.
command_id: triage-issue
last_analyzed_at: '2026-03-22T00:00:00Z'
sync_state: clean
type: item_state
---
