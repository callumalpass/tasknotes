---
id: 'github:callumalpass/tasknotes:issue:1724'
provider: github
kind: issue
key: '1724'
external_ref: callumalpass/tasknotes#1724
repo: callumalpass/tasknotes
number: 1724
remote_state: OPEN
remote_title: >-
  [FR]: improvement to mobile edit menu for recurring tasks
remote_author: prepare4robots
remote_url: 'https://github.com/callumalpass/tasknotes/issues/1724'
local_status: triaged
priority: low
difficulty: trivial
risk: low
summary: >-
  The "Mark complete for this date" and "Skip instance" options for recurring tasks are inserted
  between Status and Priority in the context menu, rather than near the date section where they
  logically belong.
notes: |-
  Root cause:
  - In TaskContextMenu.ts buildMenu(), the recurring task options (mark complete / skip instance)
    are added immediately after the Status submenu (line 57-118) before Priority and Date submenus.
    This ordering places date-related recurring actions away from the date section.

  Suggested fix (preferred):
  - Move the recurring task completion/skip block (lines 57-118 in buildMenu()) to after the
    Scheduled Date submenu, so they appear near other date-related options in the context menu.

  Fallback options:
  - Group all recurring-related items into a dedicated "Recurrence" submenu that sits alongside
    the existing Recurrence submenu (which handles changing the recurrence rule).
command_id: triage-issue
last_analyzed_at: '2026-03-26T00:03:00Z'
sync_state: clean
type: item_state
---
