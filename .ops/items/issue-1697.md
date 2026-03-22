---
id: 'github:callumalpass/tasknotes:issue:1697'
provider: github
kind: issue
key: '1697'
external_ref: callumalpass/tasknotes#1697
repo: callumalpass/tasknotes
number: 1697
remote_state: OPEN
remote_title: >-
  [FR]: Mini Calendar view and Google Calendar events
remote_author: RPGArchivist
remote_url: 'https://github.com/callumalpass/tasknotes/issues/1697'
local_status: triaged
priority: low
difficulty: hard
risk: medium
summary: >-
  Feature request to show Google Calendar events as dot indicators in the Mini
  Calendar view, similar to the Google Calendar Obsidian Plugin. Currently only
  TaskNotes tasks are visible in the Mini Calendar.
notes: |-
  Root cause:
  - Not a bug. The MiniCalendarView (src/bases/MiniCalendarView.ts) only queries
    TaskNotes task data for its dot indicators. It has no integration with
    Google Calendar events or ICS subscriptions.

  Suggested fix (preferred):
  - Extend MiniCalendarView to optionally query Google Calendar events (via
    GoogleCalendarService) and ICS subscription events, then merge their dates
    into the dot indicator rendering. Add a toggle option (e.g.,
    showExternalCalendarEvents) to the mini calendar config.

  Fallback options:
  - Provide an API hook so external plugins (like Google Calendar plugin) can
    push event dates into the Mini Calendar dot indicators.
command_id: triage-issue
last_analyzed_at: '2026-03-22T00:00:00Z'
sync_state: clean
type: item_state
---
