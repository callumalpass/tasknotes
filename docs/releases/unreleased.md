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

- Task list cards now retain a distinct keyboard focus across view refreshes,
  support Arrow Up/Down and Home/End navigation, and toggle the focused task's
  existing batch-selection state with Space. Focused or selected tasks can now
  be created, opened, edited, organized, rescheduled, reprioritized, updated,
  or deleted with task-list keyboard actions. Menus and modals temporarily own
  their keyboard input and return focus to the originating task after closing.
- Public documentation is now published from the dedicated `tasknotes.dev`
  repository. Plugin release notes and internal documentation remain in this
  repository.
