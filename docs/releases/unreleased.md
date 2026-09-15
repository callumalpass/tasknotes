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

- (#2223, #2224) Added `task-card__metadata-date--today` and `task-card__metadata-date--future` CSS classes for due and scheduled dates. Completed past dates are not classified as future when overdue styling is hidden. Thanks to @chmac for the suggestion and contribution.

## Fixed

- (#2313) Fixed ICS meetings disappearing when another guest declined. Declined meetings are hidden only when the feed identifies the calendar owner's response; otherwise they remain visible. Refresh subscriptions after updating. See [Calendar Integration](https://tasknotes.dev/features/calendar-integration/#ics-calendar-subscriptions). Thanks to @benschifman for reporting and providing the reproduction.

- (#2203) Fixed completing or skipping a recurring instance in the edit modal creating a duplicate Google Calendar event when the scheduled date advances. Manual rescheduling still creates the appropriate moved occurrence. Thanks to @christenbc for the fix.

- (#2336) Reduced the plugin bundle below Obsidian Sync Standard's 5 MB per-file limit so it can sync between devices again, and removed duplicate bundled dependencies to leave more room for future updates. Thanks to @kmalakoff for reporting and @CyberBlaed for confirming.

- (#2335) Fixed date-like text in the current note’s folder or title being replaced when choosing a task folder with `{{currentNotePath}}` or `{{currentNoteTitle}}`. Date tokens written in the folder template still work. Thanks to @hikatamika for reporting.

- (#2301) Fixed clicking the Pomodoro timer display to edit its duration. Thanks to @minnyee for reporting and identifying the cause.

- (#2328) Fixed direct status edits on occurrence notes not updating the recurring parent’s completion history or creating the next occurrence when configured. Thanks to @mudnug for reporting this.

## Changed

- (#2329) Clarified how to generate a TaskNotes API token and configure Claude Desktop's MCP bearer authentication, including restart and token replacement instructions. See [HTTP API](https://tasknotes.dev/HTTP_API/#connecting-claude-desktop-with-mcp). Thanks to @kmaustral for reporting the setup confusion and confirming the solution.
