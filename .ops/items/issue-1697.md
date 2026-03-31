---
id: issue-1697
provider: github
kind: issue
key: callumalpass/tasknotes#1697
external_ref: https://github.com/callumalpass/tasknotes/issues/1697
repo: callumalpass/tasknotes
number: 1697
remote_state: open
remote_title: "[FR]: Mini Calendar view and Google Calendar events"
remote_author: "RPGArchivist"
remote_url: https://github.com/callumalpass/tasknotes/issues/1697
local_status: triaged
priority: low
difficulty: medium
risk: low
summary: "FR: show Google Calendar events as colored dots in the Mini Calendar view"
notes: |
  ## Root cause / Scope
  The Mini Calendar view (`MiniCalendarView.ts`) currently only renders dots for TaskNotes tasks.
  The Google Calendar integration stores events through `CalendarProvider.ts` and the provider
  registry, but the Mini Calendar does not query these providers for event data. The feature would
  require the Mini Calendar to fetch events from all registered providers for each visible month
  and render them as colored dots using the calendar's color metadata.

  ## Suggested fix / Approach
  In `MiniCalendarView.ts`, after loading task data, also call
  `plugin.calendarProviderRegistry.getAllProviders()` and aggregate event dates per day.
  Render provider events as dots with the provider's calendar color. The calendar color should be
  available through the provider's `getAvailableCalendars()` method. This is a self-contained
  addition to the Mini Calendar rendering logic.
command_id: triage-issue
last_analyzed_at: "2026-03-31"
sync_state: clean
type: item_state
---
