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

- Editing filename-backed task titles now preserves the full title when sanitization, a long filename, or a duplicate name prevents an exact match. A failed rename leaves the previous title and task properties unchanged.
- (#2148) Empty project, context and tag properties no longer produce a literal `null` entry when editing tasks. Thanks to @minchinweb for reporting this.
- Completing tasks with multiline recurrence rules now retains the rule's frequency, timezone and clock instead of losing the RRULE line.
