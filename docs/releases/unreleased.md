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

- Long-running ICS subscriptions now show recurring events from the past 30 days through the next year without using the visible-event limit on historical occurrences.
- Microsoft calendar connections now fetch events and start automatic refresh immediately. Disconnecting clears calendar data and sync state, and late responses cannot restore disconnected data.
- Disabled Google and Microsoft calendars are excluded from the combined event cache.
- Google Calendar retry queues preserve concurrent edits and tasks queued while retries are running. Manual refresh reports failed calendars instead of reporting success with stale data.
- (#2226) Cleaned up exported recurring-task exclusions to include only dates in the exported series, including the final day of all-day series. This is recurrence exclusion cleanup, not a confirmed fix for every Google Calendar 400 response. Thanks to @3zra47 for reporting.
