---
id: 'github:callumalpass/tasknotes:issue:1676'
provider: github
kind: issue
key: '1676'
external_ref: callumalpass/tasknotes#1676
repo: callumalpass/tasknotes
number: 1676
remote_state: OPEN
remote_title: >-
  [FR]: Quick-Action Button in TaskView for rescheduling to today
remote_author: steven-murray
remote_url: 'https://github.com/callumalpass/tasknotes/issues/1676'
local_status: triaged
priority: low
difficulty: easy
risk: low
summary: >-
  Feature request for a one-click "reschedule to today" icon button in the
  task list view, and more broadly, customizable action icons on task cards.
notes: |-
  Root cause:
  - Not a bug. The task card (src/ui/TaskCard.ts) currently shows action
    icons for recurrence and notifications but not for rescheduling. The
    "reschedule to today" action exists in the context menu but requires
    multiple clicks.

  Suggested fix (preferred):
  - Add a configurable quick-action icon to TaskCard that calls
    TaskService.updateTask with scheduled set to today's date. Gate it
    behind a setting (e.g., showRescheduleToTodayButton) since not all
    users will want it.
  - Longer-term, make the set of visible action icons on task cards
    configurable via settings, allowing users to pick from a list of
    available actions (reschedule today, edit, open note, etc.).

  Fallback options:
  - Add a keyboard shortcut for "reschedule to today" that works on the
    focused/selected task in any view.
command_id: triage-issue
last_analyzed_at: '2026-03-22T00:00:00Z'
sync_state: clean
type: item_state
---
