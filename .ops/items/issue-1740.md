---
id: issue-1740
provider: github
kind: issue
key: callumalpass/tasknotes#1740
external_ref: https://github.com/callumalpass/tasknotes/issues/1740
repo: callumalpass/tasknotes
number: 1740
remote_state: open
remote_title: "[FR]: Add view for missed reminders"
remote_author: "imsuck"
remote_url: https://github.com/callumalpass/tasknotes/issues/1740
local_status: triaged
priority: low
difficulty: medium
risk: low
summary: "Feature request to show a list of reminders that fired while Obsidian was closed so the user can review and act on them"
notes: |
  ## Root cause / Scope
  `NotificationService` only fires reminders when the plugin is running. There is no persistence of which reminders were due during an offline period. On vault open, past-due reminders are silently skipped. The user wants a way to see all reminders whose scheduled time has passed since the last vault open.

  ## Suggested fix / Approach
  On plugin load, scan all tasks for reminders whose datetime is between `lastVaultCloseTimestamp` and `now`. Persist `lastVaultCloseTimestamp` in plugin data on `onunload`. Collect missed reminders into a list stored in plugin data. Provide either a dedicated leaf view (similar to `StatsView`) or a Notice-based summary on open that links to a filterable list. The list should allow the user to dismiss or snooze individual missed reminders.
command_id: triage-issue
last_analyzed_at: "2026-03-31"
sync_state: clean
type: item_state
---
