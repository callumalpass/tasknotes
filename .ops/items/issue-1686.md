---
id: issue-1686
provider: github
kind: issue
key: callumalpass/tasknotes#1686
external_ref: https://github.com/callumalpass/tasknotes/issues/1686
repo: callumalpass/tasknotes
number: 1686
remote_state: open
remote_title: "[Bug]: When creating a new timeblock from the advanced calendar view in a different week, the view resets to the current week"
remote_author: "Lorite"
remote_url: https://github.com/callumalpass/tasknotes/issues/1686
local_status: triaged
priority: medium
difficulty: medium
risk: medium
summary: "Calendar view resets to current week after timeblock creation when navigated to a different week"
notes: |
  ## Root cause / Scope
  In `CalendarView.ts`, when a timeblock is created via the context menu, `expectImmediateUpdate()` is
  called, which sets `_expectingImmediateUpdate = true`. When the file change triggers `onDataUpdated()`,
  this flag causes an immediate `render()` call. During `render()`, the calendar is not destroyed
  (it calls `updateCalendarEvents`, preserving the current date). However, in edge cases — such as
  when the calendar instance becomes null mid-render or when a config-change recreation is triggered —
  `initializeCalendar()` is called with `_recreateTargetDate` being null (it was never set for this
  path), and `determineInitialDate()` returns `undefined`, defaulting to today. This is the same root
  cause as #1513. The `_recreateTargetDate` is only set during config-change recreations
  (`_configChangedNeedsRecreate`), not during user-action-triggered refreshes.

  ## Suggested fix / Approach
  Before calling `initializeCalendar()` in the normal render path (when calendar is null but no
  `_recreateTargetDate` is set), capture the last known date from the calendar instance if available.
  Alternatively, persist the current calendar date into a separate `_lastKnownDate` field that is
  updated on every `getEphemeralState()` call and used as fallback in `determineInitialDate()`.
  The fix should ensure the visible week is saved before any action that might destroy and recreate
  the calendar instance.
command_id: triage-issue
last_analyzed_at: "2026-03-31"
sync_state: clean
type: item_state
---
