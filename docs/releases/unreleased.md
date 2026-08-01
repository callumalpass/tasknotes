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

- (#2064, #2066) Recurring tasks now advance correctly after their next
  scheduled date is manually adjusted, preserving due-date offsets and times
  without jumping back to an earlier occurrence. Thanks to @chmac for reporting
  and fixing this.
- (#2081, #2103) Kept task card and relationships widgets visible in reading mode
  when Obsidian scroll or preview updates remove their DOM, and refreshed visible
  widgets promptly after metadata changes. Thanks to @mukhozhuk for reporting and
  debugging this and @martin-forge for fixing it.

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

## Fixed

- (#2018) Fixed **Hide empty columns** in Kanban views with swimlanes so columns
  with no visible tasks are hidden while pinned columns remain. Thanks to
  @scottTomaszewski for reporting and fixing this.
- Fixed recurring all-day ICS subscription events keeping the original end date
  on later instances, which could cause calendar list views to show events under
  the wrong day. Thanks to @abbiefalls90.
- (#2033) Fixed the project folder badge on task cards so, when expandable
  subtasks are enabled, it expands or collapses inline subtasks instead of
  showing an unavailable-action notice. Thanks to @abbiefalls90.
- (#2040, #2041) Stopped newly created tasks from filling the Google Calendar
  retry queue when calendar export is disabled. Thanks to @chmac for reporting
  and fixing this.
- (#2046, #2051) The date and time picker now focuses the natural-language input
  when it is enabled, making keyboard-driven quick actions ready for immediate
  typing. Thanks to @DevOps-Toast for reporting this and @ther12k for fixing it.
