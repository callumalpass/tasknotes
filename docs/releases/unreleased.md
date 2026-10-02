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

- mdbase task-type upgrades now retain existing property mappings, custom stable IDs, archive tags, occurrence policies and custom constraints, with a recovery copy before structural changes. Existing collection membership defaults are preserved. Invalid canonical definitions are reported instead of being silently adopted or overwritten.
- Portable task detection now respects excluded folders. App-required Markdown/Base extensions and configured view-folder includes are added without removing existing collection configuration. Pack installation remains part of the App's engine-verified setup consent. See [Upgrading from v4 to v5](https://tasknotes.dev/migration-v4-to-v5/).

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

- Reminders are no longer lost during rescans or sleep. Missed reminders are recovered up to 24 hours back while Obsidian remains running, and completed or archived tasks no longer notify. See [Reminders](https://tasknotes.dev/features/reminders/#delivery-and-sleep).
- Recurring-instance completion accepts the legacy CLI date field and rejects invalid or conflicting dates. Firefox extension origins can access the authenticated local API.
- Webhooks now disable only after consecutive deliveries exhaust their retries, rather than after intermittent lifetime failures.
- Concurrent timer actions no longer create duplicate active entries or publish stale timer data. Pomodoro-owned trackers end at the intended completion time after sleep and leave pre-existing manual trackers running. See [Time Management](https://tasknotes.dev/features/time-management/).

- Rapid direct status edits now reconcile each completion and reopening in order, including recurring occurrence notes. Thanks to @mudnug for reporting #2328.
- Changing task identification settings now refreshes the task index, including already-existing notes recognized by the new property.
- Canonical type updates require atomic file updates, preserve concurrent external edits and return to conflict reconciliation instead of overwriting them.
- The Relationships widget initially opens the first populated view and remembers an explicitly selected view for each note during the session. See [Relationships Widget](https://tasknotes.dev/features/inline-tasks/#relationships-widget).
- (#2032) Mobile list reorder handles now support long-press dragging, cancellation and edge scrolling. Thanks to @spasche for reporting. See [Manual ordering](https://tasknotes.dev/views/task-list/#manual-ordering).
- Date picker labels, quick actions, accessibility labels and invalid-input notices now follow the selected language.

## Added

- Added **Check collection** to report invalid task records without rewriting notes. Missing creation dates and explicitly chosen status replacements can be fixed per record or together after confirmation and a verified backup. See [Migration checks](https://tasknotes.dev/migration-v4-to-v5/#check-existing-task-records).

- Added Today and Inbox commands for the configured tasks Base, plus Inbox and Archived views in newly generated defaults. See [Views](https://tasknotes.dev/views/).

## Changed

- Newly generated tasks Bases open on Today. Active default task, Kanban, and calendar views exclude the configured archive tag. Existing Base files remain unchanged unless you explicitly update them.
- New installs show Create task, Tasks, and Calendar ribbon actions; other views remain available through commands and Obsidian's ribbon configuration. Existing ribbon preferences are retained.
- The starter note now introduces creating, reviewing, and completing a task in the selected interface language. Starter guidance and upgrade hints use the native v5 settings routes.
- Google Calendar sync commands appear only when task export is enabled; current-task sync also requires an active task note.

## Fixed

- Updating default Base files now repairs open Bases whose selected view was removed. Opening a configured Base also recovers a stale selected view.
- Korean now appears as 한국어 in the language selector.

## Removed

- Removed the Statistics and Pomodoro statistics dashboards and generated Pomodoro statistics template. The Pomodoro timer, time tracking, stored history, API, and existing Base files are retained. Close any old statistics tabs after upgrading. See [Time Management](https://tasknotes.dev/features/time-management/).
- Removed the unused views button alignment control. Its saved value is retained for downgrade compatibility.

- Trim surrounding whitespace from custom property keys when loading, editing and saving settings, while retaining native validation for empty and colliding keys. This does not rename properties in existing notes. Thanks to @prethrive for reporting (#2269). See [Settings](https://tasknotes.dev/settings/).
- Prevent custom list fields from duplicating wikilinks already extracted by the shared parser.
- Preserve wikilinks containing NLP triggers, including quoted links, during task capture. Thanks to @Hermegenius for reporting (#694).
- Preserve email addresses and URL fragments when extracting tags, contexts, projects and custom fields. These selectors now require start-of-input or preceding whitespace; punctuation-adjacent selectors such as `(@work)` stay literal. See [Natural Language Input](https://tasknotes.dev/features/task-management/#natural-language-selector-rules).
- Parse repeated project prefixes without leaving a stray trigger in the title: `++personal` selects project `+personal`. Thanks to @prethrive for reporting (#2269).
- Parse Italian relative days `oggi`, `domani` and `dopodomani`, including `entro`/`per` Due forms, without changing links, metadata, escaped words or details. Thanks to @MarcoBarna for reporting (#2274).

- Editing filename-backed task titles now preserves the full title when sanitization, a long filename, or a duplicate name prevents an exact match. A failed rename leaves the previous title and task properties unchanged.
- (#2148) Empty project, context and tag properties no longer produce a literal `null` entry when editing tasks. Thanks to @minchinweb for reporting this.
- Completing tasks with multiline recurrence rules now retains the rule's frequency, timezone and clock instead of losing the RRULE line.
