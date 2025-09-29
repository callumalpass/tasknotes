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
  - Thanks to @renatomen for reporting this issue
- (#768) Fixed calendar view appearing empty in week and day views due to invalid time configuration values
  - Added time validation in settings UI with proper error messages and debouncing
  - Added runtime sanitization in calendar with safe defaults (00:00:00, 24:00:00, 08:00:00)
  - Prevents "Cannot read properties of null (reading 'years')" error from FullCalendar
  - Thanks to @kmaustral for reporting
- (#769) Fixed NLP processor incorrectly assigning hardcoded "waiting" status when "blocked" appears in task titles
  - NLP now only uses user-defined status configurations when available, ignoring hardcoded fallback patterns
  - Prevents unexpected status assignments for users with custom status workflows
  - Fallback patterns still work when no custom status configurations are defined
  - Thanks to @renatomen for reporting this issue
