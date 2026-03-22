---
id: 'github:callumalpass/tasknotes:issue:1622'
provider: github
kind: issue
key: '1622'
external_ref: callumalpass/tasknotes#1622
repo: callumalpass/tasknotes
number: 1622
remote_state: OPEN
remote_title: >-
  [FR]: Google Calendar Integration - Set Multiple Notification Interval Values for Task/Event Entries
remote_author: solidabstract
remote_url: 'https://github.com/callumalpass/tasknotes/issues/1622'
local_status: triaged
priority: low
difficulty: medium
risk: low
summary: >-
  Feature request to support multiple notification time intervals for events
  synced to Google Calendar, rather than the current single interval value.
notes: |-
  Root cause:
  - Not a bug. The current Google Calendar sync only supports a single
    notification interval configured in settings.

  Suggested fix (preferred):
  - Change the notification interval setting from a single number to an
    array of numbers (e.g., [10080, 4320, 1440, 120] for 1 week, 3 days,
    1 day, 2 hours).
  - Update the Google Calendar sync code to send multiple reminders in the
    event's reminders.overrides array when creating/updating events.
  - Update the settings UI to allow adding/removing multiple interval values.

  Fallback options:
  - Inherit notification settings from the target Google Calendar's default
    notifications, by not explicitly setting reminders on synced events
    (set reminders.useDefault = true in the Google Calendar API call).
command_id: triage-issue
last_analyzed_at: '2026-03-22T00:00:00Z'
sync_state: clean
type: item_state
---
