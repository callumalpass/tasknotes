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

## Added

- (#1791) Added collapse and expand controls for grouped Bases Task List views, including a default collapsed state option.
  - Thanks to @renatomen for the contribution.

## Fixed

- Fixed recurring all-day ICS subscription events keeping the original end date on later instances, which could cause calendar list views to show events under the wrong day.

- (#982, #1947) Restored larger mobile task-card typography and let secondary card icons wrap below the task details when they no longer fit comfortably on mobile.
  - Thanks to @3zra47 for reporting the font-size regression, @chrsdk and @scottaltham-payroc for confirming the mobile font-size issue, and @Jomo94 for reporting the mobile card layout problem.
