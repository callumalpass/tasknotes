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

## Changed

- Refreshed task lists, Kanban boards, calendars, and task dialogs with clearer typography, more consistent spacing, and colours that follow the Obsidian theme.
- Task dialog controls now show selected dates, status, priority, recurrence, and reminder counts directly. Controls wrap on narrow screens.
- Improved the readability of completed tasks and keyboard access to task menus. Simplified the shared styling and removed unused CSS utilities.

## Fixed

- Fixed Kanban hover highlights and menus flickering when unrelated notes update in the background. Unchanged boards now retain their cards and keyboard focus.
