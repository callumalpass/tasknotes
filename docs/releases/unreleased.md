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

- (#1207) Added inline search box to Bases views (Task List, Kanban, Calendar)
  - Enable via "Enable search box" toggle in view settings
  - Searches across title, status, priority, tags, contexts, projects, and visible custom properties
  - Press Escape or click × to clear search
  - Thanks to @renatomen for the PR

## Fixed

- (#1165) Fixed Kanban view grouping by list properties (contexts, tags, projects) treating multiple values as a single combined column
  - Tasks with multiple values now appear in each individual column (e.g., a task with `contexts: [work, call]` appears in both "work" and "call" columns)
  - Added "Show items in multiple columns" option (enabled by default) to control this behavior
  - Fixed drag-and-drop to properly add/remove individual values instead of replacing the entire list
  - Fixed swimlane mode to also respect list property explosion
  - Thanks to @dictionarymouse for reporting

