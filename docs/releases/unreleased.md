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

- Fixed calendar freezes in vaults with many tasks, while preserving task and timeblock drag and resize permissions.

- (#2304) Fixed embedded month calendars not filling their available width with Minimal theme and Readable Line Length enabled. Thanks to @same774 for reporting.

- (#2305) Fixed tasks due after 11:30 PM appearing on the following day in Calendar and Agenda views.
  - Thanks to @PeterYuLi1204 for reporting.

- (#2306) Fixed the task editor's completion calendar showing dates from a different month than its heading in some time zones, and skipping short months when navigating from a month-end completion.
  - Thanks to @teampbevolution for reporting.

- (#2258) Task cards now preserve spaces and emoji in context and tag labels instead of collapsing them during display. Thanks to @Oblique82 for reporting this and tracing the affected renderer.

- Fixed generated default Bases files failing to open when custom priority labels or status/priority values contain quotes, backslashes, or line breaks. Regenerate affected files with **Update default base files**. See [Default Base Templates](https://tasknotes.dev/views/default-base-templates/).

- Fixed selected-text conversion including the next unselected line when a selection ends at the start of that line. Reversed selections and partial-line selections now preserve text outside the selection. See [Inline Tasks](https://tasknotes.dev/features/inline-tasks/#instant-task-conversion).
- (#1157) Fixed long inline task titles exceeding the available line width or dropping below their status indicator in nested bullets on Obsidian mobile. Enabled properties remain available in a bounded, scrollable strip. Thanks to @3zra47 for the continued reports and screenshots, and @renatomen for fresh-vault testing. See [Inline Tasks](https://tasknotes.dev/features/inline-tasks/#task-link-overlays).

- Long-running ICS subscriptions now show recurring events from the past 30 days through the next year without using the visible-event limit on historical occurrences.
- Microsoft calendar connections now fetch events and start automatic refresh immediately. Disconnecting clears calendar data and sync state, and late responses cannot restore disconnected data.
- Disabled Google and Microsoft calendars are excluded from the combined event cache.
- Google Calendar retry queues preserve concurrent edits and tasks queued while retries are running. Manual refresh reports failed calendars instead of reporting success with stale data.
- (#2226) Cleaned up exported recurring-task exclusions to include only dates in the exported series, including the final day of all-day series. This is recurrence exclusion cleanup, not a confirmed fix for every Google Calendar 400 response. Thanks to @3zra47 for reporting.
