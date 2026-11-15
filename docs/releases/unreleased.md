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

- Fixed the layout of calendar subscription events and timeblocks in the calendar's List view. Their titles wrapped into a narrow column and their icons dropped below the text. They now use the same row layout as tasks: the icon sits where a task shows its status, the title spans the row, and the time, location and calendar name sit on the line below. Timeblocks use their calendar colour and show their time without a background.
- Fixed Sign in with Google not appearing under Settings → Google Calendar. The page showed only "Advanced: use your own Google Cloud project" until something else made the settings rebuild.

## Removed

- Removed settings that had no effect: **Disable note indexing**, **Enable fuzzy matching** for project suggestions (the project picker always matches fuzzily), and **Show due dates when scheduled** and **Show ICS events** under calendar default event visibility. Each calendar view still shows or hides each calendar subscription in its own options. Saved values stay in `data.json` for devices still on 4.x. See [Removed settings](https://tasknotes.dev/migration-v4-to-v5/#removed-settings).
- Removed **Export v3 saved views to Bases**. To convert TaskNotes v3 saved views, run the export in TaskNotes 4.x before upgrading. See [Upgrading from v3 to v4](https://tasknotes.dev/migration-v3-to-v4/#converting-saved-filter-views).
