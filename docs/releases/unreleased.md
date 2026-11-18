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

- (#2574) The task ID property can now be remapped like other task properties, under **Settings → TaskNotes → Properties → Metadata & integration properties → Task ID**. It defaults to `id`, so existing vaults are unchanged. When a collection's task type maps the ID to another property, TaskNotes uses that property. See [Task Properties](https://tasknotes.dev/settings/task-properties/#metadata-properties).
  - Thanks to @minchinweb for the request

## Fixed

## Changed

## Security
