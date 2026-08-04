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

## Security

- Calendar OAuth credentials and account tokens are now stored in Obsidian Secret Storage instead of TaskNotes' `data.json`, with automatic migration for existing connections. See [Calendar Integration](https://tasknotes.dev/features/calendar-integration/).
    - Thanks to @mcuste for the contribution

## Added

- Added portable task attachment references. Attachments now round-trip as an
  ordered `attachments` link list in task frontmatter and are exposed through
  the TaskNotes model and runtime API. These are collection-file references
  only; attachment bytes and binary metadata remain owned by the host.
- (#2142) MCP `tasknotes_create_task` and `tasknotes_update_task` now accept
  `customProperties` for configured TaskNotes user fields. Thanks to
  @phillipadsmith for suggesting this.
- (#2126, #2134) Added optional filename templates for materialized recurring
  occurrence notes, with explicit date, ISO week, month, year, and month-name
  variables plus per-parent overrides. Existing naming remains unchanged until a
  template is configured. See [Recurring Tasks](https://tasknotes.dev/features/recurring-tasks/#occurrence-filenames).
  Thanks to @raphaelfaouakhiri for reporting and implementing this.
- (#2105) Added `{{projectFolder}}` and `{{projectFolders}}` folder template
  variables for storing tasks alongside linked project notes. See
  [Template Variables](https://tasknotes.dev/features/template-variables/).
  Thanks to @carypruitt for this contribution.

## Changed

- Task list cards now retain a distinct keyboard focus across view refreshes,
  support Arrow Up/Down and Home/End navigation, and toggle the focused task's
  existing batch-selection state with Space. Focused or selected tasks can now
  be created, opened, edited, organized, rescheduled, reprioritized, updated,
  or deleted with task-list keyboard actions. Menus and modals temporarily own
  their keyboard input and return focus to the originating task after closing.
- Generated TaskNotes type contracts now include configured natural-language
  capture triggers, allowing compatible clients to offer the same field
  suggestions.
- Rebuilt the TaskNotes documentation as a v5-ready, source-generated site with
  reorganized navigation, full-text search, mobile and accessibility
  improvements, and references generated from the current commands, settings,
  compatibility metadata, HTTP routes, and default Bases. Added practical
  guides for adopting TaskNotes in an existing vault, mobile use, custom Bases,
  and backup and recovery. See the
  [TaskNotes documentation](https://tasknotes.dev/).
- (#2088) Convert current note to task now uses your default scheduled date when
  the note does not already have `scheduled` frontmatter, while the **None**
  default still leaves converted notes unscheduled. See
  [Task Properties](https://tasknotes.dev/settings/task-properties/#scheduled-date).
  Thanks to @e-zz for suggesting this.

## Fixed

- (#2182) Checklist progress on task cards now excludes cancelled markdown
  checklist items such as `[-]` from the completed/total count. Thanks to
  @ctrl-q for reporting this.
- (#2180) Inline task cards in Live Preview now keep their click and context menu
  handlers active on Obsidian 1.13, so clicking a rendered task link opens the
  edit modal instead of revealing the raw wikilink. Thanks to @npondel for the
  detailed diagnosis and @minchinweb for confirming the issue.
- ([#2171](https://github.com/callumalpass/tasknotes/pull/2171)) Stopped recurring
  notification and status-bar scans from reading unindexed notes directly from
  disk while preserving the fallback for direct task lookups. Thanks to
  @tgrosinger for identifying and diagnosing the excessive vault reads.
- (#2174) **Open or create occurrence note** from Quick Actions now uses the
  recurring task's scheduled occurrence date, preventing duplicate occurrence
  notes keyed to the day the action was run. Thanks to @chmac for reporting
  this.
- (#2169) Regenerated default Base views now include tasks whose identifying
  property is stored as a list containing the configured task value. Thanks to
  @GlebYavorski for reporting this.
- (#2166) Fixed Task List views configured to start collapsed so the first
  chevron click expands only the selected group instead of expanding every
  other group. Thanks to @renatomen for reporting and fixing this.
- (#2165) **Convert current note to task** now reads configured field mappings,
  including list-valued title fields such as `aliases`, and preserves an
  existing aliases list when the title is unchanged. Thanks to @jkuball for
  reporting this.
- (#2164) Flat Kanban boards now clear stale swimlane layout state when they
  rerender, preventing columns from occasionally stacking into one vertical
  strip after switching tabs. Thanks to @brienna for reporting this.
- (#2160, #2161) Generated Kanban Bases now use the correct TaskNotes status
  property and configuration block. Rich Bases status values render as their
  configured labels, while pinned columns and saved column order are honored.
  Thanks to @kevin-4c for the detailed reports and diagnosis.
- (#2111, #2159) Recurring task instances now remain visible through the final
  day of Calendar and Agenda ranges in positive-offset time zones, regardless
  of the configured first day of the week. Thanks to @Arachnidai and @odxn0803
  for reporting this.
- (#2155) Regenerated default Calendar Bases now inherit the app-level time slot
  duration instead of hardcoding 30 minutes. Existing per-Base time settings
  remain intentional overrides. Thanks to @SZZ504232 for reporting this.
- (#2154) Timed ICS events without a `TZID` now preserve their floating wall
  time in the user's local timezone instead of being interpreted as UTC. Thanks
  to @cloesophia for the reproducible calendar sample.
- (#2152) Fixed paginated Google Calendar refreshes for calendars with many
  events so secondary calendars do not disappear after Google returns a second
  page. Thanks to @wobafett for reporting and diagnosing this.
- (#2141) Fixed Task List groups for tasks without scheduled or due dates showing
  a raw Bases icon object instead of **None**. Thanks to @ks-studio-net for
  reporting this.
- (#2140) The edit task modal now shows saved task-identification tags when
  hiding identification tags is disabled. Thanks to @3zra47 for reporting this.
- (#2148) Empty list-like frontmatter values no longer become literal `"null"`
  entries when tasks are edited. Thanks to @minchinweb for reporting this.
- (#2120, #2135) Long all-day event titles in Calendar week and day views now
  truncate instead of stretching the all-day row. Thanks to @same774 and
  @ks-studio-net for reporting this.
- (#2124) Fixed a Kanban crash when opening or closing the edit modal immediately
  after moving a task between list-valued swimlanes such as contexts. Thanks to
  @Decia-C for reporting this.
- (#2114) Completing a rescheduled occurrence for a scheduled-anchored recurring
  task now advances the parent from the moved occurrence date instead of an
  earlier original occurrence date. Thanks to @chrabia for reporting this.
- (#2113) Failed Google Calendar manual refreshes no longer make the next
  immediate refresh show a misleading success notice. Thanks to @JohWQ for
  reporting this.
- (#2109) TaskNotes no longer injects instant-conversion controls into embedded
  or detached Markdown editors, preventing checkbox notes opened from unrelated
  Bases from freezing Obsidian on mobile. Thanks to @jmartinmcfly for the clear
  reproduction and recording.
- (#2107, #2108) Creating tasks with **Store title in filename** enabled now
  handles duplicate or case-variant titles without failing or replacing the task
  title with a suffixed filename. Thanks to @AdmiralClackington for reporting and
  diagnosing this.
- (#2106) Regenerated default Calendar Base files now use your configured first
  day of the week instead of forcing Sunday. Thanks to @atos2212-blip, @cweekly,
  and @idontcode34 for reporting this.
- (#2100) Tags added while creating a task now keep the same frontmatter order as
  tags added later from the task context menu. Thanks to @mgrecar for reporting
  this.
- (#2092) New non-recurring tasks created directly in a completed status now get
  a completed date, so completed-date views can find them immediately. Thanks
  to @Crell for reporting this.
- (#2096) Fixed TaskNotes Kanban swimlanes falling back to **None** when the
  swimlane used a Bases formula that was not already cached by Bases. Thanks to
  @ddevaal for reporting this.
- (#2093) TaskNotes now retries custom Bases view registration when the Bases
  core plugin is enabled after TaskNotes, preventing default views from showing
  **Unknown view type** until TaskNotes is reloaded. Thanks to @yaye-work for
  reporting this.
- (#2084) The Relationships widget no longer prevents editor text selection from
  autoscrolling when dragging below the bottom edge of a task note. Thanks to
  @lostwildland for reporting this.
- (#2081, #2103) Kept task card and relationships widgets visible in reading mode
  when Obsidian scroll or preview updates remove their DOM, and refreshed visible
  widgets promptly after metadata changes. Thanks to @mukhozhuk for reporting and
  debugging this and @martin-forge for fixing it.
- (#2064, #2066) Recurring tasks now advance correctly after their next
  scheduled date is manually adjusted, preserving due-date offsets and times
  without jumping back to an earlier occurrence. Thanks to @chmac for reporting
  and fixing this.
- (#2018) Fixed **Hide empty columns** in Kanban views with swimlanes so columns
  with no visible tasks are hidden while pinned columns remain. Thanks to
  @scottTomaszewski for reporting and fixing this.
- Fixed recurring all-day ICS subscription events keeping the original end date
  on later instances, which could cause calendar list views to show events under
  the wrong day. Thanks to @abbiefalls90.
- (#2033) Fixed the project folder badge on task cards so, when expandable
  subtasks are enabled, it expands or collapses inline subtasks instead of
  showing an unavailable-action notice. Thanks to @abbiefalls90.
- (#2040, #2041) Stopped newly created tasks from filling the Google Calendar
  retry queue when calendar export is disabled. Thanks to @chmac for reporting
  and fixing this.
- (#2046, #2051) The date and time picker now focuses the natural-language input
  when it is enabled, making keyboard-driven quick actions ready for immediate
  typing. Thanks to @DevOps-Toast for reporting this and @ther12k for fixing it.
- (#2125, #2129) Materialized recurring occurrence notes now record the date
  they were actually completed, while the parent recurring task continues to
  track the occurrence date. Thanks to @raphaelfaouakhiri for reporting and
  fixing this.
- (#2173, #2175) Completion-anchored recurring tasks with materialized
  occurrence notes now schedule the next occurrence from the day the occurrence
  was actually completed. Thanks to @chmac for reporting and fixing this.
- (#1982) Preserved the Task List's own scroll position during Bases refreshes so
  long mobile lists do not jump back to the top after task updates. Thanks to
  @3zra47 for the follow-up report.
- (#1863) Microsoft Calendar event updates now accept opaque Exchange calendar
  IDs instead of failing local validation before contacting Microsoft Graph.
  Thanks to @fmacondray for reporting this and providing the follow-up stack
  trace.
