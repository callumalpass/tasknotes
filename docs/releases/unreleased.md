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

- Added **Hide mdbase folders in the file explorer**, enabled by default. Metadata files remain available in search and the quick switcher. New mdbase setups put types, contracts and schemas under `_mdbase/`, with a README; existing vaults keep their folders. See [Integrations](https://tasknotes.dev/settings/integrations/#hide-mdbase-folders-in-the-file-explorer).
- (#2542) Google and Microsoft calendar events shown in TaskNotes calendar views can now be deleted from their right-click menu, after a confirmation. For a recurring event, only the clicked occurrence is deleted. The option is not shown for read-only calendars or ICS subscriptions. See [Calendar Integration](https://tasknotes.dev/features/calendar-integration/#synchronization-behavior).
  - Thanks to @iantierney for the request

## Changed

- The Google Calendar settings now say more plainly that exporting tasks and timeblocks needs your own Google Cloud project. The connection page is now called **Advanced: use your own Google Cloud project**, and both export pages say what to connect, and where, until it is connected. See [Calendar Integration Setup](https://tasknotes.dev/calendar-setup/#google-calendar).
- On desktop, Task List rows are more compact. In a list at least 640 pixels wide, each task takes a single line, with its properties, dates and priority lined up on the right. In narrower lists the two-line rows are about a third shorter.
