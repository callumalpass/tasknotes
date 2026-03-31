---
id: issue-1658
provider: github
kind: issue
key: callumalpass/tasknotes#1658
external_ref: https://github.com/callumalpass/tasknotes/issues/1658
repo: callumalpass/tasknotes
number: 1658
remote_state: open
remote_title: "[Bug]: Pomodoro stats mis-bucket sessions into \"Today\" around local midnight (timezone)"
remote_author: "ewgdg"
remote_url: https://github.com/callumalpass/tasknotes/issues/1658
local_status: triaged
priority: medium
difficulty: easy
risk: medium
summary: "Pomodoro sessions near local midnight are bucketed into the wrong calendar day because groupSessionsByDate uses UTC date extraction"
notes: |
  ## Root cause / Scope
  `PomodoroService.groupSessionsByDate()` (line 1148) does `formatDateForStorage(new Date(session.startTime))`. The `formatDateForStorage()` function uses `date.getUTCFullYear()/getUTCMonth()/getUTCDate()` (UTC methods). When `session.startTime` is an ISO string representing local time (e.g., `"2026-03-31T23:55:00"` in UTC+2), `new Date("2026-03-31T23:55:00")` is parsed as local time but `formatDateForStorage` reads UTC components, yielding `"2026-03-31"` when the local date is `"2026-04-01"` — or vice versa for negative UTC offsets. The same issue exists in `getStatsForDate()` (line 1013) which calls `formatDateForStorage(new Date(session.startTime))` for the session date. Note: `getTodayStats()` (line 1050) already uses `getTodayLocal()` + `createUTCDateFromLocalCalendarDate()` to get an anchored today, suggesting awareness of the issue, but the session bucketing path was not updated consistently.

  ## Suggested fix / Approach
  Replace `formatDateForStorage(new Date(session.startTime))` in `groupSessionsByDate()` and `getStatsForDate()` with a local-time date extraction. Either use `new Date(session.startTime).toLocaleDateString('sv')` (returns YYYY-MM-DD in local time) or extract local components manually (`getFullYear()/getMonth()/getDate()`). Alternatively, ensure `session.startTime` is always stored as a UTC ISO string and use `formatDateForStorage` consistently. This is an easy single-file fix in `PomodoroService.ts`.
command_id: triage-issue
last_analyzed_at: "2026-03-31"
sync_state: clean
type: item_state
---
