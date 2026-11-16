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

## Changed

- TaskNotes adds less time to Obsidian startup. Bundled interface translations are now decoded only for English and the language in use, instead of for all ten languages, each time the plugin loads. In testing, this halved the plugin's load time (from about 145 ms to about 70 ms).
  - Less work runs just after the workspace opens. The reminder check reads only tasks that have reminders; the default Bases view files are no longer regenerated when they already exist; and the task index warmup runs when Obsidian is idle instead of during startup. In a test vault with 8,000 notes, this cut that setup from about 160 ms to about 75 ms.
  - Background setup that follows is lighter. Daily notes are listed for Google Calendar timeblock sync only when timeblock sync is on, and tasks are no longer all loaded up front to detect direct edits to task files; each task's earlier state is read only when it is edited. In the same test vault, this cut that work from about 180 ms to about 65 ms.
