---
id: 'github:callumalpass/tasknotes:issue:1713'
provider: github
kind: issue
key: '1713'
external_ref: callumalpass/tasknotes#1713
repo: callumalpass/tasknotes
number: 1713
remote_state: OPEN
remote_title: >-
  [FR]: Export timeless tasks as a daytime event
remote_author: bepolymathe
remote_url: 'https://github.com/callumalpass/tasknotes/issues/1713'
local_status: triaged
priority: medium
difficulty: easy
risk: low
summary: >-
  Tasks with a scheduled date but no specific time are exported as ICS events
  starting at midnight instead of as all-day events. This causes them to display
  incorrectly in external calendar apps.
notes: |-
  Root cause:
  - In CalendarExportService.parseTaskDate() (line ~430), date-only strings are parsed as `T00:00:00` (midnight). The ICS export then emits DTSTART with a datetime value rather than a DATE-only value.
  - Per RFC 5545, all-day events should use `DTSTART;VALUE=DATE:YYYYMMDD` format instead of `DTSTART:YYYYMMDDTHHMMSSZ`.
  - The getICSDateFormat() and generateMultipleTasksICSContent() methods always format dates with time components, never detecting that a task lacks a time component.

  Suggested fix (preferred):
  - In CalendarExportService, detect when a task's scheduled/due date has no time component (is date-only, e.g. "2026-03-20" without "T").
  - For date-only tasks, emit `DTSTART;VALUE=DATE:YYYYMMDD` and `DTEND;VALUE=DATE:YYYYMMDD+1` (next day) per ICS all-day event convention.
  - Modify getICSDateFormat() to return a flag indicating whether dates are date-only or datetime.

  Fallback options:
  - Add a setting "Export timeless tasks as all-day events" (default true) for backward compatibility.
  - Only apply all-day export to tasks that have zero time estimate as well.
command_id: triage-issue
last_analyzed_at: '2026-03-22T00:00:00Z'
sync_state: clean
type: item_state
---
