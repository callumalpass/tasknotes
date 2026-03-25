---
id: 'github:callumalpass/tasknotes:issue:1726'
provider: github
kind: issue
key: '1726'
external_ref: callumalpass/tasknotes#1726
repo: callumalpass/tasknotes
number: 1726
remote_state: OPEN
remote_title: >-
  [FR]: Auto-complete or auto-skip specific recurring tasks after their scheduled time expires
remote_author: cjpc222
remote_url: 'https://github.com/callumalpass/tasknotes/issues/1726'
local_status: triaged
priority: low
difficulty: hard
risk: medium
summary: >-
  Feature request for recurring tasks to automatically resolve (complete or skip) after their
  scheduled time plus timeEstimate has elapsed, controlled by a frontmatter property like
  autoResolve: complete | skip.
notes: |-
  Root cause:
  - Not a bug. Currently there is no mechanism to automatically advance recurring task instances
    based on elapsed time. Users must manually mark done or skip each instance.

  Suggested fix (preferred):
  - Add a new frontmatter property (e.g., autoResolve: complete | skip) recognized by the plugin.
  - Implement a periodic check (on plugin load and at intervals) that evaluates recurring tasks
    with autoResolve set, comparing current time against scheduled + timeEstimate + optional grace period.
  - When elapsed, auto-trigger the same logic as toggleRecurringTaskComplete or toggleRecurringTaskSkipped
    in TaskService depending on the autoResolve value.

  Fallback options:
  - Implement as a command that users run manually or bind to a hotkey to "resolve all expired recurring tasks."
  - Add a global setting with a cron-like schedule rather than per-task frontmatter.
command_id: triage-issue
last_analyzed_at: '2026-03-26T00:03:00Z'
sync_state: clean
type: item_state
---
