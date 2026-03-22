---
id: 'github:callumalpass/tasknotes:issue:1700'
provider: github
kind: issue
key: '1700'
external_ref: callumalpass/tasknotes#1700
repo: callumalpass/tasknotes
number: 1700
remote_state: OPEN
remote_title: >-
  [FR]: Selective export to google calendar based on folder or context
remote_author: hokfujow
remote_url: 'https://github.com/callumalpass/tasknotes/issues/1700'
local_status: triaged
priority: low
difficulty: medium
risk: low
summary: >-
  Feature request to filter which tasks are exported to Google Calendar by context
  or folder, so users can export personal tasks without including work tasks.
notes: |-
  Root cause:
  - Not a bug. AutoExportService and TaskCalendarSyncService currently export all tasks with dates; there is no filter/exclusion mechanism for calendar export.

  Suggested fix (preferred):
  - Add a calendarExportFilter setting (context, folder, or tag-based) to settings. Apply the filter in AutoExportService and GoogleCalendarService before building the export set.
  - Reuse existing BasesFilterConverter patterns to keep filter logic consistent.

  Fallback options:
  - Allow users to specify an explicit inclusion/exclusion list of contexts or folders in the Google Calendar sync settings tab (src/settings/tabs/integrationsTab.ts).
command_id: triage-issue
last_analyzed_at: '2026-03-22T00:00:00Z'
sync_state: clean
type: item_state
---
