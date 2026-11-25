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

- (#2677) Restored drag-and-drop reordering for task statuses and priorities in Properties settings. Thanks to @hikatamika for reporting.
- (#2106) Open calendars that use the global first-day-of-week setting now update as soon as it changes. Thanks to @atos2212-blip and @leon-adsk for reporting.
- Improved recovery when an interrupted mdbase v0.2 to v0.3 metadata upgrade leaves a pending recovery record and rollback is blocked by a changed metadata file. TaskNotes now shows a calm startup notice and adds persistent recovery controls under **Settings → TaskNotes → TaskNotes App** to either keep current files and resume sync or restore the verified v0.2 backup while keeping backup folders intact.
- (#2694) Fixed overlapping and misaligned icons in the task creation and editing dialogs when Media DB is enabled. Thanks to @techy-robot for reporting.
- (#2698) Dragging an all-day task into the calendar’s timed grid now previews the task’s time estimate. Thanks to @Oneiran for reporting.
