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

- Added a versioned TaskNotes JavaScript runtime API for companion plugins, with namespaced model validation, catalogs, query/support helpers, task, time-tracking, Pomodoro, recurring-task, settings, NLP, event, and extension-registry surfaces. Runtime API mutations carry source and correlation metadata so companion plugins can debug and coordinate workflow runs. See [JavaScript API](https://tasknotes.dev/javascript-api/).
- Added documentation for the companion-plugin model and the TaskNotes Workflows companion plugin. See [Companion Plugins](https://tasknotes.dev/companion-plugins/) and [TaskNotes Workflows](https://tasknotes.dev/companion-plugins/tasknotes-workflows/).
- (#288, #345, #361, #523, #573, #703, #925, #929, #1115, #1137, #1260, #1303, #1324, #1394, #1445, #1509, #1735, #1736, #1743, #1780, #1874, #1951, #1974) Added support for TaskNotes spec 0.2.0 materialized occurrences, including recurrence parent/date fields, generated mdbase schema roles, parent reconciliation when occurrence notes are completed, occurrence notes that inherit parent planning metadata without copying history, occurrence note controls in task, calendar, and edit-modal completion menus, and visible occurrence identity on task cards. This gives recurring tasks a concrete occurrence-note path for per-instance state, related notes, subtasks, templates, scheduling changes, completion history, and calendar behavior without forcing every recurring task to create files. See [Recurring Tasks](https://tasknotes.dev/features/recurring-tasks/#materialized-occurrence-notes) and [Property Types Reference](https://tasknotes.dev/settings/property-types-reference/#materialized-occurrence-properties). Thanks to @LuxBetancourt, @luciolebrillante, @jhedlund, @cathywu, @Lorite, @EllenGYY, @JcMinarro, @gsssr, @3zra47, @Leonard-44, @ak-42, @RumiaKitinari, @atos2212-blip, @kmaustral, @eugenedefox, @notDavid, @zitongcharliedeng, and @Jomo94 for the related recurrence, occurrence, completion, and calendar requests.
- (#1951) Added Calendar support for recurring tasks stretched between scheduled and due dates when the existing stretch option is enabled. Date-only ranges stay as all-day spans, and timed ranges render once per day in the range. Thanks to @atos2212-blip for the request.
- (#1510, #1751, #1792, #1969) Added a Task List and Kanban view option to hide top-level subtasks when their parent task is also in the filtered view, while still allowing inherited expanded relationships to show the subtasks under the parent. Thanks to @Kickdak and @Glint-Eye for the requests, @inigourrestarazu for identifying the project-linked parent edge case, and @stanley-910 and @Spencerduran for the earlier PRs.

## Changed

- Moved core TaskNotes model behavior for field mapping, dates, recurrence, time-tracking, and adapter operation planning into a shared package used by the plugin and companion tooling.
- Calendar views now coalesce materialized occurrence notes with their matching virtual recurring instances. Dragging a materialized occurrence reschedules that occurrence note without changing the parent recurrence rule or the note's `occurrence_date` identity. See [Recurring Tasks](https://tasknotes.dev/features/recurring-tasks/#calendar-drag-and-drop).
- Improved the Calendar Bases View Options menu by splitting settings into clearer groups and hiding view-specific controls until they apply to the selected calendar mode.

## Fixed

- (#1976) Fixed embedded Calendar and Agenda Bases so "Navigate to date from property" can use the containing note's date property when the Base rows do not have that property. Thanks to @matesvecenik for reporting this.
- (#1977) Fixed Calendar and Agenda views showing duplicate all-day entries when a task's scheduled date and due date are the same day. Timed due dates on the same day still show as separate deadline markers. Thanks to @pdgBC for reporting this.
- Fixed the release notes view using cramped interface typography instead of regular reading typography.
- (#216) Improved inline conversion for Tasks plugin task lines, including Dataview-style fields, priority markers, recurrence text, date aliases, block links, and safer trailing-field parsing. Thanks to @ksdavidc for the request, @natleahh for the Dataview example, and @hangryscribe3 and @nayatiuh for the discussion.
- (#1974) Stopped Calendar and Agenda property-based events from logging date parse errors for entries that do not have the selected date property. Thanks to @Jomo94 for suggesting completed-date Agenda events.
- (#1973) Reduced unnecessary Calendar view recreations when external calendar providers are reported in a different order, and preserved Calendar scroll position when a config-driven refresh has to recreate the view. Thanks to @e-zz for reporting this.
- (#1972) Fixed ICS calendar event related notes so standalone events with similar numeric IDs no longer show unrelated notes or tasks on every event. Thanks to @ks-studio-net for reporting this.
- (#1970) Fixed generated default Base filters so updating default files applies configured excluded folders to TaskNotes task views. Thanks to @henrim01 for reporting that templates could still appear in regenerated views.
- (#1968) Fixed inline task link overlays collapsing on Obsidian mobile, which could hide the task title and leave a tall empty gap after the widget. Thanks to @renatomen for reporting and diagnosing the containment issue.
