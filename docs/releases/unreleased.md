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

- Added an enabled-by-default startup check for new compatible TaskNotes releases. When a new release is available, TaskNotes shows a notice that opens the TaskNotes entry in Obsidian's Community Plugins browser.
- Added translations for the new startup release-check setting and update notice.
- (#1989) Added a command-palette action plus runtime and HTTP API actions for updating configured default `.base` files from the current TaskNotes templates. Thanks to @businessBoris for the request.
- (#1115) Added API and MCP support for creating materialized occurrence notes from recurring tasks, and made headless recurring-instance completion respect occurrence notes when the parent uses Create next after completion. Thanks to @martin-forge for identifying the API/MCP gap.

## Fixed

- (#1985) Fixed embedded Calendar and Agenda time-grid views drifting out of alignment inside callouts and Reading mode. Thanks to @matesvecenik for reporting and sharing screenshots.
- (#1986) Fixed the local HTTP API rejecting requests from the TaskNotes browser extension's Chrome extension origin. Thanks to @n1njaznutz for reporting this.
- (#1980) Added mobile bottom spacing to Agenda Calendar views so the last visible tasks can scroll above Obsidian's bottom navigation bar. Thanks to @Jomo94 for reporting and sharing the screenshot.
- (#1984) Fixed mobile task link overlays hiding configured inline task card properties such as scheduled date, due date, contexts, and projects. Thanks to @stil-sudo for reporting.
- (#1979) Kept the left-positioned subtask chevron from overlapping the task status control on mobile task cards. Thanks to @Jomo94 for reporting and sharing the screenshot.
- (#1903) Reduced the Edit Task modal's mobile action-button footer so Open note, Archive, Delete, Save, and Cancel take two rows instead of three on iPhone-sized screens. Thanks to @3zra47 for the original report and @krzyfu for the follow-up about the button area crowding the editor.
- (#1982) Preserved scroll position in TaskNotes Bases after task edits and data refreshes, avoiding jumps back to the top on mobile. Thanks to @3zra47 for reporting.
- (#1978) Restored Obsidian editor shortcuts such as insert link, headings, and list toggles inside the Edit Task modal's Details editor. Thanks to @krzyfu for reporting this.
