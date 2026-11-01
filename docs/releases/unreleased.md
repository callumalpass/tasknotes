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

- (#1811) Restored dragging tasks onto Calendar views to schedule them. Inline task widgets can be dragged again, and so can Task List and Kanban cards; dropping on a time slot sets a scheduled date and time, and dropping on a date or the all-day row sets a scheduled date. See [Calendar views](https://tasknotes.dev/views/calendar-views/). Thanks to @ghake for reporting this.
- (#2061) Fixed reminder system notifications not appearing on Windows. Windows silently drops notifications with long tags, and reminder notifications were tagged with the full task path. They now use a short tag, so they appear like the test notification does
  - Thanks to @Xiarno for reporting, and to @hokutonanto, @jahlpub, @pepijnvtol and @dmantisk for confirming it across Windows 11 setups
