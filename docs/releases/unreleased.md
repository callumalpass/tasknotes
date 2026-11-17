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

- (#2243, #2553) Fixed Google Calendar events missing from calendar and agenda views after Obsidian restarts until the calendar was reconnected. The first sync after startup now loads each calendar's full event range instead of only the changes since the previous session.
  - Documented that Google expires connections from OAuth apps in testing mode after 7 days, and how to publish the app so the connection lasts. See [Calendar Integration Setup](https://tasknotes.dev/calendar-setup/#google-calendar).
  - Thanks to @Robubble for reporting, and to @stefan-f-bucher for the related report in #2226
- (#2555) Natural language parsing now uses the NLP triggers shown in settings. Previously, if saved settings had no project trigger, an empty one, or one with surrounding spaces, settings showed `+` as enabled, but text like `+Admin` was not added to projects and stayed in the task title. Trigger characters entered in settings are now saved without surrounding spaces.
  - Thanks to @jdhauck for reporting
- (#2559) Fixed clicking a task's status in a Bases view when the note is included by the view's filter but not identified as a task by TaskNotes' task identification settings (for example, a view filtered on `type: task` while TaskNotes identifies tasks by tag). Recurring tasks failed with "Failed to execute 'structuredClone' on 'Window'", and other tasks showed "Task not found". Both now update. Saving the Undo for a recurring completion no longer copies view data, and if Undo cannot be prepared the completion still saves.
  - Thanks to @0x326-CHR for reporting
- (#2559) When TaskNotes cannot read its settings file at startup, it now says so instead of failing with only Obsidian's "Failed to load" message. It still does not start, so your settings are not overwritten with defaults. The notice says that restarting Obsidian usually fixes this and that reinstalling TaskNotes deletes its settings. TaskNotes also now waits up to about two seconds for the file to become readable, since during a plugin update the previous version can still be saving it.
  - Thanks to @0x326-CHR for reporting
