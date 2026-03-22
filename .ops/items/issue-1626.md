---
id: 'github:callumalpass/tasknotes:issue:1626'
provider: github
kind: issue
key: '1626'
external_ref: callumalpass/tasknotes#1626
repo: callumalpass/tasknotes
number: 1626
remote_state: OPEN
remote_title: >-
  [Bug]: ICS subscription recurring events truncated by maxInstances=100 cap
remote_author: pib
remote_url: 'https://github.com/callumalpass/tasknotes/issues/1626'
local_status: triaged
priority: medium
difficulty: trivial
risk: low
summary: >-
  ICS subscription recurring events with high frequency (3+/week) are silently
  truncated because parseICS() caps expansion at 100 instances, which is too
  low for multi-day-per-week events within the 1-year window.
notes: |-
  Root cause:
  - In src/services/ICSSubscriptionService.ts line ~432, maxInstances is
    hardcoded to 100. For events recurring 3x/week, 100 instances covers
    only ~8 months, not the full 1-year expansion window.
  - Additionally, instanceCount is incremented for EXDATE-excluded dates
    (line ~443), so events with many exceptions lose even more visible
    instances toward the cap.

  Suggested fix (preferred):
  - Increase maxInstances to ~3000 (covers daily events for a full year
    with margin). The maxDate check (1 year from now) already prevents
    truly unbounded expansion, so the instance cap is just a safety net.
  - Move instanceCount++ (line ~443) to after the EXDATE check so excluded
    dates don't count toward the cap.

  Fallback options:
  - Make maxInstances configurable in settings.
  - Calculate maxInstances dynamically based on the RRULE frequency.
command_id: triage-issue
last_analyzed_at: '2026-03-22T00:00:00Z'
sync_state: clean
type: item_state
---
