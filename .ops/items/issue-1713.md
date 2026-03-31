---
id: issue-1713
provider: github
kind: issue
key: callumalpass/tasknotes#1713
external_ref: https://github.com/callumalpass/tasknotes/issues/1713
repo: callumalpass/tasknotes
number: 1713
remote_state: open
remote_title: "[FR]: Export timeless tasks as a daytime event"
remote_author: "bepolymathe"
remote_url: https://github.com/callumalpass/tasknotes/issues/1713
local_status: triaged
priority: low
difficulty: easy
risk: low
summary: "Feature request to export tasks that have a scheduled date but no time as all-day calendar events instead of midnight-anchored timed events"
notes: |
  ## Root cause / Scope
  Interestingly, src/services/CalendarExportService.ts already implements all-day export via DTSTART;VALUE=DATE when a scheduled date has no time component (getICSDateProperties, ~line 410). The reporter may be hitting a code path that falls through to a timed export, or the feature was added after this report was filed. The due-date-only export path (~line 558 in the same file) still uses a timed DTSTART if only `due` is set without `scheduled`. There may also be a display issue where the calendar client receives a VALUE=DATE event but still shows it at midnight due to client behaviour.

  ## Suggested fix / Approach
  Verify that the all-day export path is triggered correctly for date-only scheduled fields. Ensure the due-date export fallback also uses VALUE=DATE when no time is present. Consider adding an explicit TRANSP:TRANSPARENT property so all-day exported tasks do not block calendar time. Document the existing all-day behaviour in release notes so users are aware.
command_id: triage-issue
last_analyzed_at: "2026-03-31"
sync_state: clean
type: item_state
---
