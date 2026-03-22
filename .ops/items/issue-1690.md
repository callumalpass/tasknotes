---
id: 'github:callumalpass/tasknotes:issue:1690'
provider: github
kind: issue
key: '1690'
external_ref: callumalpass/tasknotes#1690
repo: callumalpass/tasknotes
number: 1690
remote_state: OPEN
remote_title: >-
  Feature Request: Option to delete Google Calendar event when task is completed
remote_author: Flowburghardt
remote_url: 'https://github.com/callumalpass/tasknotes/issues/1690'
local_status: triaged
priority: low
difficulty: easy
risk: low
summary: >-
  Feature request to add a setting that deletes the Google Calendar event when
  a task is marked done, instead of the current behavior of prefixing the
  title with a checkmark.
notes: |-
  Root cause:
  - Not a bug. The current completeTaskInCalendar() in
    TaskCalendarSyncService.ts (line 834) only supports updating the event
    title with a checkmark prefix. There is no option to delete the event
    on completion.

  Suggested fix (preferred):
  - Add a completionBehavior setting to googleCalendarExport settings with
    options: 'update' (current default, adds checkmark), 'delete' (calls
    deleteTaskFromCalendar), and 'none' (do nothing). In
    completeTaskInCalendar(), branch on this setting. The deleteTaskFromCalendar
    infrastructure already exists and works.

  Fallback options:
  - Repurpose the existing syncOnTaskComplete boolean into a tri-state
    setting: off / update-title / delete-event.
command_id: triage-issue
last_analyzed_at: '2026-03-22T00:00:00Z'
sync_state: clean
type: item_state
---
