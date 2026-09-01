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

- (#811) Added two-way CalDAV sync for tasks. TaskNotes can now keep a vault in sync with a CalDAV task list such as Nextcloud, Apple Reminders, Radicale or Baikal, in both directions. Configure accounts under Settings -> TaskNotes -> Integrations. See [CalDAV Sync](https://tasknotes.dev/features/caldav-sync/).
  - Each synced task stores its CalDAV identifier in frontmatter, so disconnecting and reconnecting later picks up where it left off instead of creating duplicates.
  - When a task is edited in both places at once, the more recent change wins, and the change that lost is recorded in the debug log.
  - Choose what happens locally when a task is deleted on the server: archive the note (default), keep it without syncing, or delete it.
  - Each account can be scoped with a filter, so separate task lists can hold separate sets of tasks.
  - Subtasks and blocking relationships are carried across as standard CalDAV task links, so a task hierarchy built in TaskNotes shows up as a hierarchy in Nextcloud Tasks or Apple Reminders.
  - Reminders become alarms on the server, so a reminder set in Obsidian can notify you on your phone. Alarms added in other apps are left untouched.
  - Passwords are kept in Obsidian secret storage rather than in the plugin's data file, and are only sent over HTTPS.
  - A change that could not be sent because the server was unreachable is queued and retried rather than lost.
  - Added commands to sync with CalDAV on demand and to unlink every task from CalDAV.
  - Thanks to @Archetype444 for the request.
- (#2147) Added context-menu actions for recording task completion today, on the scheduled date, on the due date, or on a chosen date. The actions can be grouped in a submenu from Appearance settings. See [Completing Tasks](https://tasknotes.dev/features/task-management/#completing-tasks).
  - Rescheduling a recurring task can reactivate affected completed or skipped instances after confirmation. See [Recurring Tasks](https://tasknotes.dev/features/recurring-tasks/).
  - Thanks to @renatomen for the contribution.
