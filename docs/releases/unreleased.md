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

-->

## Fixed

- (#1952) Fixed Pomodoro task picker search results so matching task titles are ranked and sorted ahead of due-date ordering.
  - Thanks to @KFrancoD for reporting.
- (#1392, #1949) Fixed due and scheduled date picker fields so typed or pasted date edits stay open until you choose Select, including compact `YYYYMMDD` entry when a date is already set.
  - Thanks to @kazerniel for reporting and following up.
- (#982, #1947) Restored larger mobile task-card typography and let secondary card icons wrap below the task details when they no longer fit comfortably on mobile.
  - Thanks to @3zra47 for reporting the font-size regression, @chrsdk and @scottaltham-payroc for confirming the mobile font-size issue, and @Jomo94 for reporting the mobile card layout problem.
