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

## Fixed

- Fixed tracked-time blocks in the calendar hiding the task title unless the block was very short. The title now appears beside the status icon, as it does on scheduled tasks.
- Fixed calendar event titles being cut through the middle of a line in blocks of about an hour. Titles now show as many whole lines as fit above the time and end with an ellipsis, and blocks too short for both put the title and time on one row. This also follows Obsidian's font size setting.

## Changed

## Security
