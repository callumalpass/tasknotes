---
id: 'github:callumalpass/tasknotes:issue:1704'
provider: github
kind: issue
key: '1704'
external_ref: callumalpass/tasknotes#1704
repo: callumalpass/tasknotes
number: 1704
remote_state: OPEN
remote_title: >-
  [FR]: option widen today on multi-day calendar
remote_author: dictionarymouse
remote_url: 'https://github.com/callumalpass/tasknotes/issues/1704'
local_status: triaged
priority: low
difficulty: easy
risk: low
summary: >-
  Feature request to make the current day column wider (1.5-2x) in multi-day
  calendar views (day, week) for better orientation and detail visibility.
notes: |-
  Root cause:
  - Not a bug. The calendar view (src/bases/CalendarView.ts and styles/calendar-view.css) renders all day columns with equal width.

  Suggested fix (preferred):
  - In CalendarView's multi-day rendering, detect the "today" column and apply a CSS class (e.g. .calendar-day--today-wide) with a configurable width multiplier.
  - Add a setting in appearance settings for the today-column width multiplier (default 1.0, options 1.0/1.5/2.0).

  Fallback options:
  - Expose a CSS custom property (--tasknotes-today-column-width-ratio) that users can override via CSS snippets without requiring a settings UI.
command_id: triage-issue
last_analyzed_at: '2026-03-22T00:00:00Z'
sync_state: clean
type: item_state
---
