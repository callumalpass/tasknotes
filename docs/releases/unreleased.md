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

- Rapid direct status edits now reconcile each completion and reopening in order, including recurring occurrence notes. Thanks to @mudnug for reporting #2328.
- Changing task identification settings now refreshes the task index, including already-existing notes recognized by the new property.
- Canonical type updates require atomic file updates, preserve concurrent external edits and return to conflict reconciliation instead of overwriting them.
- The Relationships widget initially opens the first populated view and remembers an explicitly selected view for each note during the session. See [Relationships Widget](https://tasknotes.dev/features/inline-tasks/#relationships-widget).
- (#2032) Mobile list reorder handles now support long-press dragging, cancellation and edge scrolling. Thanks to @spasche for reporting. See [Manual ordering](https://tasknotes.dev/views/task-list/#manual-ordering).
- Date picker labels, quick actions, accessibility labels and invalid-input notices now follow the selected language.
