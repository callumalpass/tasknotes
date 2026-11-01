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

- (#2285) Swimlane rows in Kanban views can be reordered by dragging their labels. The order is saved in the view's `swimLaneOrder` option, and rows hidden by search or by **Hide Empty Swimlanes** keep their positions. Dragging rows needs a mouse for now. See [Kanban View](https://tasknotes.dev/views/kanban-view/)
  - Thanks to @borsos-ilo for requesting this, and to @ppeirce for the interaction design and the original implementation in PR #1862
- (#2138) Property-based task identification can match on a property alone. Leave **Task property value** empty to treat every note that has the property as a task, whatever its value (for example any note with a `status` property). Task detection, the default Base files (`file.hasProperty()`) and the generated mdbase type (`exists: true`) all use this rule, and new or converted tasks get the property if they don't have it. See [General settings](https://tasknotes.dev/settings/general/)
  - If you already have a property name set with the value left empty, which previously identified no tasks, every note with that property now becomes a task after updating. Set a value to keep the old matching
  - Thanks to @jcconnects for requesting this and for the original implementation in PR #2139
- (#974) Added optional syncing of daily-note timeblocks to Google Calendar. Turn on **Sync timeblocks** under **Settings → TaskNotes → Integrations → Export timeblocks to Google Calendar** to create, update and delete events as you add, edit, move and remove timeblocks. Timeblocks can use their own target calendar and event title template. See [Calendar Integration](https://tasknotes.dev/features/calendar-integration/#syncing-timeblocks-to-google-calendar).
  - Thanks to @karthikm-0 for requesting this, and to @Lorite for the original implementation in #1677

## Fixed

- (#1811) Restored dragging tasks onto Calendar views to schedule them. Inline task widgets can be dragged again, and so can Task List and Kanban cards; dropping on a time slot sets a scheduled date and time, and dropping on a date or the all-day row sets a scheduled date. See [Calendar views](https://tasknotes.dev/views/calendar-views/). Thanks to @ghake for reporting this.
- (#2061) Fixed reminder system notifications not appearing on Windows. Windows silently drops notifications with long tags, and reminder notifications were tagged with the full task path. They now use a short tag, so they appear like the test notification does
  - Thanks to @Xiarno for reporting, and to @hokutonanto, @jahlpub, @pepijnvtol and @dmantisk for confirming it across Windows 11 setups
- (#2276) Creating or converting a task now says when its filename differs from its title because filenames cannot contain characters such as `/ \ : * ? " < > |`. The notice names the file that was created. The full title was already kept in the task's title property and shown in TaskNotes views, but Obsidian's tab, file list and quick switcher show the filename, so the change looked like lost text. This applies on every platform
  - Thanks to @mudnug for reporting
- (#2274) Changing the NLP language now applies straight away to instant task conversion and to the HTTP API and MCP parse tools. Previously these kept parsing in the language that was set when Obsidian started, so Italian phrases such as "Comprare latte oggi" were left unparsed until a restart
  - Thanks to @MarcoBarna for reporting
- (#2379) Generated Bases files now give tasks with a missing or unrecognized priority a `priorityWeight` of `-1` instead of `999`, so sorting by `formula.priorityWeight` in descending order lists High, Normal, Low, None, and then those tasks, and they no longer rank as the most urgent in `urgencyScore` sorts. The documentation now explains that sorting by `priority` itself is alphabetical and that `formula.priorityWeight` sorts in your configured priority order when sorted descending, correcting earlier guidance that said ascending. Existing Bases files keep their formula; see [Sort by priority](https://tasknotes.dev/guides/custom-bases/#sort-by-priority) to update it. Thanks to @iantierney for reporting this.
- (#2202) Recurring tasks created without a scheduled date now get one: the first upcoming occurrence, with the start time kept for timed recurrences. Previously only the recurrence start was written, so features that need a scheduled date, such as Google Calendar export, skipped the task until it was edited. Series that have already ended are left unscheduled
  - Thanks to @christenbc for finding this and for the original fix in PR #2202
