---
id: 'github:callumalpass/tasknotes:issue:1678'
provider: github
kind: issue
key: '1678'
external_ref: callumalpass/tasknotes#1678
repo: callumalpass/tasknotes
number: 1678
remote_state: OPEN
remote_title: >-
  [FR]: Open the timeblock modal with the task title prefilled from the task context menu
remote_author: Lorite
remote_url: 'https://github.com/callumalpass/tasknotes/issues/1678'
local_status: triaged
priority: low
difficulty: easy
risk: low
summary: >-
  Feature request to add a "Create timeblock" action to the task context menu
  that opens the TimeblockCreationModal with the task title and scheduling info
  prefilled.
notes: |-
  Root cause:
  - Not a bug. The task context menu (src/components/TaskContextMenu.ts)
    does not currently include a timeblock creation action. The
    TimeblockCreationModal (src/modals/TimeblockCreationModal.ts) exists
    but is only opened from the calendar view's date-select context menu.

  Suggested fix (preferred):
  - Add a "Create timeblock" menu item to TaskContextMenu that opens
    TimeblockCreationModal with prefilled values: task title as the
    timeblock title, task.scheduled as the start date/time (or current
    date as fallback), and task.timeEstimate as the duration (or default
    duration as fallback).

  Fallback options:
  - Add this as a command palette action instead of a context menu item.
command_id: triage-issue
last_analyzed_at: '2026-03-22T00:00:00Z'
sync_state: clean
type: item_state
---
