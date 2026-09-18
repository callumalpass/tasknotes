# TaskNotes - Unreleased

## Changed

- Rebuilt settings around Obsidian’s native navigation, search, and editable lists. Individual settings are searchable. Ordinary preferences and property triggers use inline groups, while larger editors and advanced filters retain detail pages. See [Settings](https://tasknotes.dev/settings/) for the new layout.
- TaskNotes now requires Obsidian 1.13.1 or newer.

## Fixed

- Fixed task dialogs falling back to plain text inputs when opened without an active note, including from release notes or in an empty vault.

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
