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

- Reminders are no longer lost during rescans or sleep. Missed reminders are recovered up to 24 hours back while Obsidian remains running, and completed or archived tasks no longer notify. See [Reminders](https://tasknotes.dev/features/reminders/#delivery-and-sleep).
- Recurring-instance completion accepts the legacy CLI date field and rejects invalid or conflicting dates. Firefox extension origins can access the authenticated local API.
- Webhooks now disable only after consecutive deliveries exhaust their retries, rather than after intermittent lifetime failures.
- Concurrent timer actions no longer create duplicate active entries or publish stale timer data. Pomodoro-owned trackers end at the intended completion time after sleep and leave pre-existing manual trackers running. See [Time Management](https://tasknotes.dev/features/time-management/).
