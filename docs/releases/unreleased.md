# TaskNotes - Unreleased

<!--

**Added** for new features.
**Changed** for changes in existing functionality.
**Deprecated** for soon-to-be removed features.
**Removed** for now removed features.
**Fixed** for any bug fixes.
**Security** in case of vulnerabilities.

Always acknowledge contributors and those who report issues.

Example:

```
## Fixed

- (#768) Fixed calendar view appearing empty in week and day views due to invalid time configuration values
  - Added time validation in settings UI with proper error messages and debouncing
  - Prevents "Cannot read properties of null (reading 'years')" error from FullCalendar
  - Thanks to @userhandle for reporting and help debugging
```

When a change has user-facing documentation, include a canonical tasknotes.dev link:

```
## Added

- Added materialized occurrence notes for recurring tasks. See [Recurring Tasks](https://tasknotes.dev/features/recurring-tasks/#materialized-occurrence-notes) for setup and calendar behavior.
```

-->

## Added

- (#2147) Added context-menu actions for recording task completion today, on the scheduled date, on the due date, or on a chosen date. The actions can be grouped in a submenu from Appearance settings. See [Completing Tasks](https://tasknotes.dev/features/task-management/#completing-tasks).
  - Rescheduling a recurring task can reactivate affected completed or skipped instances after confirmation. See [Recurring Tasks](https://tasknotes.dev/features/recurring-tasks/).
  - Completion-date actions, submenu settings, and rescheduling confirmations are translated into all supported languages.
  - Thanks to @renatomen for the contribution.

## Fixed

- (#2291) Preserved background task updates when saving an older task edit window, including recurring completion history and fields removed by another writer. Thanks to @martin-forge for the fix.
- (#2294) Stopped plugin startup when an existing settings file cannot be read, preserving it for recovery instead of starting services with default settings. Thanks to @GGlider for reporting settings loss in #1591 and @martin-forge for the fix.
- (#2322) Fixed metadata edits deleting the saved title when a filename cannot represent it, such as for long titles. Existing title properties are preserved on unrelated edits; this does not recover previously deleted titles. Thanks to @1dezer1 for reporting.
- (#2255, #2300) Fixed task cards repeatedly disappearing and being restored while scrolling in Reading mode, which could pull the note down to the bottom. Thanks to @logicelf for the diagnosis and @nelsonlove for the fix.
- (#2318) Kept calendar events chronological when a Base sort is configured, using Base order for tasks at the same time. Thanks to @ky1ejs for reporting #1411 and @martin-forge for the fix.
- (#2319) Avoided duplicate recurring-task projections when an original occurrence date is already recorded by a calendar move. Completion and skip history remain visible when requested. Moves without recorded original-date metadata are not covered by this fix. Thanks to @martin-forge for the fix.
- (#2309) Fixed Google calendars enabled through the `primary` alias using the wrong color, ignoring visibility toggles, or losing their calendar name on event cards and linked notes. Thanks to @martin-forge for the fix.
- (#2279) Fixed Google Calendar authorization stalling when the system browser opens but does not report back that it launched. Authorization now completes or times out independently, and overlapping attempts cannot stop the active connection attempt. Thanks to @DamienDLR for the diagnosis.
- (#2298, #2299) Kept timed recurrence anchors when saving custom recurrence or completing a completion-anchored instance. Timed anchors are written with `Z`; their clock components, including seconds, are preserved without a device-timezone conversion. Date-only rules and scheduled-anchor completion are unchanged. See [Recurring Tasks](https://tasknotes.dev/features/recurring-tasks/). Thanks to @wellsbk1 for reporting.
- (#2043, #2055) Fixed tasks created with the default Subtasks view's **+** button missing their project and immediately disappearing from the view. Thanks to @kudrmax for reporting and @ther12k for the initial fix.
- (#2284) Prevented repeated activation of instant checkbox conversion from creating duplicate TaskNotes while the first conversion is still in progress. Thanks to @doyoonear for reporting.
- (#2314) Fixed rescheduled ICS recurring events appearing at their original time and cancelled occurrences remaining visible. Thanks to @benschifman for reporting.
- (#1849) Fixed context menus stacking on top of each other. Only one menu stays open at a time, and clicking the same indicator again closes its menu. This previously applied to date fields only, and now covers priority, status, recurrence, reminders, task, ICS event, and batch menus.
  - Thanks to @3zra47 for reporting and @YBKF for the contribution.
- (#2303) Removed the extra space after inline task links on desktop while retaining the task menu on touch devices.
  - Thanks to @nelsonlove for the fix.

## Changed

- (#2316) Clarified the Google OAuth Desktop app setup and redirect-mismatch troubleshooting, including why fixed Web application redirect URLs are not reliable with dynamic callback ports. See [Calendar Setup](https://tasknotes.dev/calendar-setup/). Thanks to @TomaszGaweda for reporting and following up.

## Security

- (#2292) Required authentication for local API/MCP listeners. When no token is configured, TaskNotes generates and saves one before listening. Clients that previously omitted authentication must supply the token from Integrations settings. OAuth callbacks now use an OS-assigned loopback port, accept each authorization state only once, and return fixed pages without reflecting callback text. Thanks to @martin-forge for the hardening.
