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

- Improved TaskNotes startup performance by allowing Bases registration to finish asynchronously. Thanks to @tgrosinger for the contribution.

## Fixed

- Fixed `PUT /api/tasks/:id` ignoring empty arrays for `contexts` and `blockedBy`: sending `{"contexts": []}` or `{"blockedBy": []}` now clears the corresponding frontmatter field instead of silently leaving the previous value in place. The deletion pass previously fired only on a literal `undefined`, which JSON cannot express, so HTTP clients had no way to clear these fields. Thanks to @tgrosinger for the contribution.
