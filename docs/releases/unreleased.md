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
  - Added runtime sanitization in calendar with safe defaults (00:00:00, 24:00:00, 08:00:00)
  - Prevents "Cannot read properties of null (reading 'years')" error from FullCalendar
  - Thanks to @userhandle for reporting and help debugging
```

-->

## Fixed

- (#766) Fixed tag parsing incorrectly identifying notes with tags containing "task" (like "pkm-task") as task notes
  - Added exact hierarchical tag matching for task identification to prevent false positives
  - Preserved substring matching behavior for filter bar searches where it's desired
  - Only exact matches or hierarchical children (like "task/work") now identify notes as tasks
  - Thanks to @anareaty and @fastrick for reporting this issue
- (#767) Fixed subgroups not rendering under the "Overdue" agenda group
  - Overdue section now properly renders subgroups when enabled in Agenda View
  - Added expand/collapse controls for overdue subgroups matching regular day sections
  - Maintains consistent functionality and styling across all agenda groups
  - Thanks to @renatomen for reporting this issue
- (#768) Fixed calendar view appearing empty in week and day views due to invalid time configuration values
  - Added time validation in settings UI with proper error messages and debouncing
  - Added runtime sanitization in calendar with safe defaults (00:00:00, 24:00:00, 08:00:00)
  - Prevents "Cannot read properties of null (reading 'years')" error from FullCalendar
  - Thanks to @kmaustral for reporting
