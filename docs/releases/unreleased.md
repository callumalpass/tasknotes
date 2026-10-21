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

- (#2412) Recurring task checkoffs now show the completed occurrence and next date, including the year, with an Undo action. Undo restores the affected occurrence and schedule without overwriting later changes. Thanks to @PaulSnyder for the suggestion. See [Recurring Tasks](https://tasknotes.dev/features/recurring-tasks/#completion-tracking).
- (#2413) Reminders that came due while Obsidian was closed are now shown when it starts, up to 24 hours back. Missed reminders show when they were due, only the latest one per task is shown, and more than three are combined into one summary. Thanks to @aliceinblunderland0 for the suggestion. See [Task Reminders](https://tasknotes.dev/features/reminders/#delivery-and-sleep).

## Fixed

- (#2411) Google calendars now display user-set names instead of original titles for subscribed and URL-added calendars. Thanks to @Alireza-RS for reporting.
