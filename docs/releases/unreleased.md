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

## Changed

- (#1282) Added spacing between task title and metadata in inline task widgets for improved readability
  - Thanks to @3zra47 for the suggestion
- Custom status icons now display in all context menus (task context menu, batch operations menu, and task creation/edit modals)
- Added embedded video guide for Google Calendar OAuth setup in documentation
  - Thanks to [@antoneheyward](https://www.youtube.com/@antoneheyward) for the tutorial

## Fixed

- (#1279) Fixed Kanban column width setting not being respected on mobile devices
  - Thanks to @guncav for reporting
- (#1026, #1177) Fixed recurring task completion from Base views recording the wrong date for users in negative UTC offset timezones (e.g., PST/PDT) when completing tasks in the evening
  - The bug caused `complete_instances` to record the next day instead of the user's current calendar day
  - Thanks to @3zra47 and @nslee123 for reporting and providing detailed reproduction steps

