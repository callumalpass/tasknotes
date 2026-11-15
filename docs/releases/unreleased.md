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

- Added a **TaskNotes App** page to TaskNotes settings. It links to TaskNotes App on the web, iPhone and Android, shows QR codes for the App Store and Google Play, and lists the steps to use the app with the tasks in your vault: turn on type definitions, install the mdbase Connect desktop app, add the vault folder (with a **Copy folder path** button), and sign in to the app with the same account. It shows whether type definitions are on and whether the vault has been added to mdbase Connect. The **TaskNotes: Set up TaskNotes App** command opens the page. See [Use TaskNotes App with your vault](https://tasknotes.dev/guides/tasknotes-app/).
- The release notes shown after an update now start with links to TaskNotes App on the web, iPhone and Android, and its setup guide.
- The **HTTP API** settings page explains that the HTTP API and MCP server only run while Obsidian is open, and links to the mdbase MCP server, which reaches your tasks at any time once the vault is synced with mdbase Connect.

## Changed

- **Generate mdbase type definitions** is now **Turn on type definitions**, the first setup step on the **TaskNotes App** settings page. **Hide mdbase folders in the file explorer** moved from **Calendars & integrations** to **TaskNotes App → Advanced**.
- Type definitions are now on by default for new installs. Vaults updated from v4 or an earlier 5.0 beta keep their setting, because TaskNotes 4 on another device can overwrite the v5 task type; the setup step asks you to update every device first. Turning it on creates `mdbase.yaml` and the `_mdbase/` folder, which are hidden in the file explorer by default, and upgrades TaskNotes-generated mdbase v0.2 metadata to v0.3. Task notes are not changed. See [Integrations](https://tasknotes.dev/settings/integrations/#mdbase).

## Fixed

- Turning on mdbase type definitions in a vault that had none no longer shows "TaskNotes restored the missing canonical mdbase.yaml file". Nothing had been restored; TaskNotes was reading its own new files back as outside changes.
- Fixed the layout of calendar subscription events and timeblocks in the calendar's List view. Their titles wrapped into a narrow column and their icons dropped below the text. They now use the same row layout as tasks: the icon sits where a task shows its status, the title spans the row, and the time, location and calendar name sit on the line below. Timeblocks use their calendar colour and show their time without a background.
- Fixed Sign in with Google not appearing under Settings → Google Calendar. The page showed only "Advanced: use your own Google Cloud project" until something else made the settings rebuild.
- Fixed changing a task's status, priority, dates or other properties failing after the task had been dragged to another Kanban column or Task List group. The change was not saved, and the console logged `DataCloneError: Failed to execute 'structuredClone'`. The dragged task could also keep showing old values after its note was edited, until Obsidian restarted.

## Removed

- Removed settings that had no effect: **Disable note indexing**, **Enable fuzzy matching** for project suggestions (the project picker always matches fuzzily), and **Show due dates when scheduled** and **Show ICS events** under calendar default event visibility. Each calendar view still shows or hides each calendar subscription in its own options. Saved values stay in `data.json` for devices still on 4.x. See [Removed settings](https://tasknotes.dev/migration-v4-to-v5/#removed-settings).
- Removed **Export v3 saved views to Bases**. To convert TaskNotes v3 saved views, run the export in TaskNotes 4.x before upgrading. See [Upgrading from v3 to v4](https://tasknotes.dev/migration-v3-to-v4/#converting-saved-filter-views).
