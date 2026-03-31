---
id: issue-1726
provider: github
kind: issue
key: callumalpass/tasknotes#1726
external_ref: https://github.com/callumalpass/tasknotes/issues/1726
repo: callumalpass/tasknotes
number: 1726
remote_state: open
remote_title: "[FR]: Auto-complete or auto-skip specific recurring tasks after their scheduled time expires"
remote_author: "cjpc222"
remote_url: https://github.com/callumalpass/tasknotes/issues/1726
local_status: triaged
priority: low
difficulty: hard
risk: high
summary: "Feature request to automatically mark or skip recurring tasks after their scheduled time plus time estimate has elapsed, via a configurable frontmatter property"
notes: |
  ## Root cause / Scope
  Users with daily routine recurring tasks want the plugin to automatically advance or resolve them once the scheduled window has passed without manual action. This would prevent stale overdue instances from cluttering the calendar view. There is currently no auto-resolution mechanism; the recurrence engine only advances `scheduled` when the user explicitly marks complete or skips an instance.

  ## Suggested fix / Approach
  Introduce an `autoResolve: complete | skip` frontmatter property (or a plugin setting) that is checked by a background timer or on plugin load. A new AutoResolveService (parallel to AutoArchiveService in src/services/) would query recurring tasks with autoResolve set, compute whether the scheduled time + timeEstimate + grace period has elapsed, and call the existing toggleRecurringTaskComplete or toggleRecurringTaskSkipped methods accordingly. Risk is high because this writes to task files autonomously without explicit user action, which could cause unintended data changes if the logic is incorrect. A grace-period setting and dry-run mode would be essential before shipping.
command_id: triage-issue
last_analyzed_at: "2026-03-31"
sync_state: clean
type: item_state
---
