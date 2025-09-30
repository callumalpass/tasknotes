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

- (#776) Fixed screens failing to load with "toLowerCase is not a function" error
  - Issue occurred when frontmatter tags array contained non-string values (numbers, booleans, etc.)
  - Added type validation to filter out non-string values before processing tags
  - Valid string tags continue to work normally while invalid types are safely skipped
  - Thanks to @kmf and @Andre-Ioda for help debugging this issue
