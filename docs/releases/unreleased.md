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

## Added

## Fixed

## Changed

- TaskNotes adds less time to Obsidian startup. Bundled interface translations are now decoded only for English and the language in use, instead of for all ten languages, each time the plugin loads.
  - Less work runs just after the workspace opens. The reminder check reads only tasks that have reminders; the default Bases view files are no longer regenerated when they already exist; and the task index warmup runs when Obsidian is idle instead of during startup.
  - Background setup is lighter. Daily notes are listed for Google Calendar timeblock sync only when timeblock sync is on, and tasks are no longer all loaded up front to detect direct edits to task files; each task's earlier state is read only when it is edited.

## Security
