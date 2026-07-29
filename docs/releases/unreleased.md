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
- Custom recurrence dialog Interval and Days of week descriptions now update based on the selected frequency (for example, "Every x days" when Daily is selected).
- Custom recurrence dialog weekday checkboxes stay on one row with clearer spacing below the description, and radio option markers are centered when selected.
- Native date and time fields across recurrence, date/time picker, timeblock, and reminder modals share consistent padding, border, and corner rounding.

## Fixed

- Fixed the Custom recurrence dialog's Monthly, Yearly, and End condition options so switching between "on this date" and "on the Nth weekday" (or between "never"/"after N occurrences"/"until a date") greys out the fields that no longer apply, instead of leaving both sets of controls active and editable at once.
- Fixed the Custom recurrence dialog not being translated, despite translations already being available for it.
