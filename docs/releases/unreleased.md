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

- (#1961) Fixed the default custom filename template so it uses the recommended double-brace syntax and no longer warns on first use.
  - Thanks to @chmac for reporting.
- (#1962) Fixed task tag normalization so tags entered with spaces are saved with hyphens for Obsidian tag compatibility.
  - Thanks to @christenbc for reporting.
- (#1959) Fixed the MCP `tasknotes_list_tasks` tool so circular internal task data no longer makes the response fail.
  - Thanks to @kmaustral for reporting.
- (#1957) Fixed the Pomodoro timer layout in vertically split panes so the timer header and progress circle remain reachable when the pane is short.
  - Thanks to @sumiyalairu03 for reporting.
- (#1956) Fixed Google Calendar sync so completing a recurring task updates the linked event title with the completion checkmark.
  - Thanks to @jacksoluke for reporting.
- (#1953) Fixed inline task conversion so source-line wikilinks no longer create nested wikilinks in the replacement link text.
  - Thanks to @bgk0018 for reporting.
- (#1952) Fixed Pomodoro task picker search results so matching task titles are ranked and sorted ahead of due-date ordering.
  - Thanks to @KFrancoD for reporting.
- (#1392, #1949) Fixed due and scheduled date picker fields so typed or pasted date edits stay open until you choose Select, including compact `YYYYMMDD` entry when a date is already set.
  - Thanks to @kazerniel for reporting and following up.
- (#982, #1947) Restored larger mobile task-card typography and let secondary card icons wrap below the task details when they no longer fit comfortably on mobile.
  - Thanks to @3zra47 for reporting the font-size regression, @chrsdk and @scottaltham-payroc for confirming the mobile font-size issue, and @Jomo94 for reporting the mobile card layout problem.
