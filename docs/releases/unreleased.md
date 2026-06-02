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

## Fixed

- (#1980) Added mobile bottom spacing to Agenda Calendar views so the last visible tasks can scroll above Obsidian's bottom navigation bar. Thanks to @Jomo94 for reporting and sharing the screenshot.
- (#1984) Fixed mobile task link overlays hiding configured inline task card properties such as scheduled date, due date, contexts, and projects. Thanks to @stil-sudo for reporting.
- (#1903) Reduced the Edit Task modal's mobile action-button footer so Open note, Archive, Delete, Save, and Cancel take two rows instead of three on iPhone-sized screens. Thanks to @3zra47 for the original report and @krzyfu for the follow-up about the button area crowding the editor.
- (#1982) Preserved scroll position in TaskNotes Bases after task edits and data refreshes, avoiding jumps back to the top on mobile. Thanks to @3zra47 for reporting.
