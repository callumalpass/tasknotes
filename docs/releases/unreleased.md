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

- Brought the TaskNotes settings record (`_settings/dev.tasknotes.md`) in line with the `mdbase.app-settings` contract. Opening a vault no longer creates the record or adds this device's settings to it, so one device can't change a collection's settings just by opening it. A setting missing from the record, or invalid in it, now takes its default instead of this device's saved value, and removing the record returns every setting to its default. The record is created on the first change you make, and upgrades still move your settings into it. See [Migrating to v5](https://tasknotes.dev/migration-v4-to-v5/#tasknotes-settings-record).

## Fixed

- Fixed dropping a recurring task onto a completed Kanban status also completing the next occurrence when the task was completed elsewhere during the drag. Board refreshes now wait until the drag ends. See [Recurring Tasks](https://tasknotes.dev/features/recurring-tasks/#completion-tracking).
- Fixed dragging a card reversing the other cards in a Kanban column when manual order is sorted descending. Kanban now follows the configured sort direction, matching Task List. Columns already reordered under a descending sort will show their intended order once after updating; stored ranks are not rewritten when the view opens.
- (#2513) Fixed **Skip instance** in the menu on calendar list and Agenda cards skipping the task's next occurrence instead of the one on that row, from both the ⋮ button and right-clicking the card.
