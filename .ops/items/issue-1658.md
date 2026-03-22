---
id: 'github:callumalpass/tasknotes:issue:1658'
provider: github
kind: issue
key: '1658'
external_ref: callumalpass/tasknotes#1658
repo: callumalpass/tasknotes
number: 1658
remote_state: OPEN
remote_title: >-
  [Bug]: Pomodoro stats mis-bucket sessions into "Today" around local midnight (timezone)
remote_author: ewgdg
remote_url: 'https://github.com/callumalpass/tasknotes/issues/1658'
local_status: triaged
priority: medium
difficulty: medium
risk: medium
summary: >-
  Pomodoro sessions near local midnight are bucketed into the wrong day because getStatsForDate()
  compares session dates using formatDateForStorage() which uses UTC methods, while sessions are
  recorded with local timestamps.
notes: |-
  Root cause:
  - In src/services/PomodoroService.ts lines 1007-1014, getStatsForDate() converts both the
    target date and each session's startTime to date strings via formatDateForStorage(), which uses
    getUTCFullYear/getUTCMonth/getUTCDate. For getTodayStats(), the target date is
    createUTCDateFromLocalCalendarDate(getTodayLocal()), which correctly anchors "today" in UTC.
    However, session.startTime is stored as a local timestamp (Date.now() or ISO string), and
    when formatDateForStorage(new Date(session.startTime)) is called, it extracts the UTC date
    components, which may differ from the local calendar date near midnight. For example, a
    session started at 11:50 PM EST (04:50 UTC next day) would be bucketed into the next day.

  Suggested fix (preferred):
  - When bucketing sessions, convert session.startTime to a local calendar date before comparing.
    Replace `formatDateForStorage(new Date(session.startTime))` with a function that extracts
    the local date (getFullYear/getMonth/getDate) rather than UTC date components, matching the
    user's expectation of "today" in their timezone.

  Fallback options:
  - Store session dates as explicit local date strings (YYYY-MM-DD) at recording time, avoiding
    the UTC conversion entirely during stats computation.
command_id: triage-issue
last_analyzed_at: '2026-03-22T00:00:00Z'
sync_state: clean
type: item_state
---
