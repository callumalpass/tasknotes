---
id: issue-1622
provider: github
kind: issue
key: callumalpass/tasknotes#1622
external_ref: https://github.com/callumalpass/tasknotes/issues/1622
repo: callumalpass/tasknotes
number: 1622
remote_state: open
remote_title: "[FR]: Google Calendar Integration - Set Multiple Notification Interval Values for Task/Event Entries"
remote_author: "solidabstract"
remote_url: https://github.com/callumalpass/tasknotes/issues/1622
local_status: triaged
priority: low
difficulty: medium
risk: low
summary: "FR: allow configuring multiple Google Calendar notification intervals instead of a single value"
notes: |
  ## Root cause / Scope
  The Google Calendar sync settings currently support only a single notification interval (in minutes). The Google Calendar API supports multiple reminders per event (`event.reminders.overrides` array). The feature request asks for an array of interval values (e.g., 10080 min for 1 week, 4320 for 3 days, 1440 for 1 day, 120 for 2 hours), or alternatively an option to inherit the default calendar reminders instead of setting plugin-specific ones.

  ## Suggested fix / Approach
  Change the `googleCalendarNotificationMinutes` setting from a single number to an array of numbers. Update the settings UI to allow adding/removing interval entries. Update `GoogleCalendarService.ts` to build the `reminders.overrides` array from the array value when creating/updating events. Add migration for existing single-value configs.
command_id: triage-issue
last_analyzed_at: "2026-03-31"
sync_state: clean
type: item_state
---
