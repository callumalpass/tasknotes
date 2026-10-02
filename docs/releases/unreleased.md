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

- Fixed selected-text conversion including the next unselected line when a selection ends at the start of that line. Reversed selections and partial-line selections now preserve text outside the selection. See [Inline Tasks](https://tasknotes.dev/features/inline-tasks/#instant-task-conversion).
- (#1157) Fixed long inline task titles exceeding the available line width or dropping below their status indicator in nested bullets on Obsidian mobile. Enabled properties remain available in a bounded, scrollable strip. Thanks to @3zra47 for the continued reports and screenshots, and @renatomen for fresh-vault testing. See [Inline Tasks](https://tasknotes.dev/features/inline-tasks/#task-link-overlays).
