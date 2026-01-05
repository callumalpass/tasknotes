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

- (#1205) Google Calendar export for tasks
  - Sync tasks to Google Calendar based on scheduled or due dates
  - Automatic sync on task create, update, complete, and delete
  - Configurable event title templates with placeholders (`{{title}}`, `{{status}}`, `{{priority}}`, etc.)
  - Event descriptions include task metadata and optional Obsidian deep link
  - Support for all-day or timed events with customizable duration
  - Event color customization using Google Calendar's color palette
  - Default reminder setting for popup notifications
  - Bulk sync and unlink actions in settings
  - Task-event linking stored in frontmatter (`googleCalendarEventId`)
