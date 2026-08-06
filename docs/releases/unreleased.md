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

- Generated TaskNotes type contracts now include configured natural-language
  capture triggers, allowing compatible clients to offer the same field
  suggestions.
- Rebuilt the TaskNotes documentation as a v5-ready, source-generated site with
  reorganized navigation, full-text search, mobile and accessibility
  improvements, and references generated from the current commands, settings,
  compatibility metadata, HTTP routes, and default Bases. Added practical
  guides for adopting TaskNotes in an existing vault, mobile use, custom Bases,
  and backup and recovery. See the
  [TaskNotes documentation](https://tasknotes.dev/).

## Fixed

- Fixed recurring tasks without a scheduled date not syncing to Google Calendar by ensuring a scheduled date is set whenever recurrence is saved, even when the custom recurrence start date is left empty.
