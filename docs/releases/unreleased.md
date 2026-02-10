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

- (#1581) Fixed Pomodoro starting break instead of work session after app restart
  - After completing a work session and restarting, pressing Start would incorrectly start a break
  - Now properly resets `nextSessionType` when clearing stale sessions or stopping the timer
  - Thanks to @Sirnii for the detailed bug report and root cause analysis

- (#1577) Fixed Edit Note/Task modal hiding action buttons when content exceeds viewport height
  - Added vertical scroll to modal content area while keeping buttons pinned at bottom
  - Thanks to @hossam-elshabory for reporting
