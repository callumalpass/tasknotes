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

-->

## Added

- (#1951) Added Calendar support for recurring tasks stretched between scheduled and due dates when the existing stretch option is enabled. Date-only ranges stay as all-day spans, and timed ranges render once per day in the range. Thanks to @atos2212-blip for the request.
- (#1510, #1751, #1792, #1969) Added a Task List and Kanban view option to hide top-level subtasks when their parent task is also in the filtered view, while still allowing inherited expanded relationships to show the subtasks under the parent. Thanks to @Kickdak and @Glint-Eye for the requests, @inigourrestarazu for identifying the project-linked parent edge case, and @stanley-910 and @Spencerduran for the earlier PRs.

## Fixed

- (#1974) Stopped Calendar and Agenda property-based events from logging date parse errors for entries that do not have the selected date property. Thanks to @Jomo94 for suggesting completed-date Agenda events.
- (#1973) Reduced unnecessary Calendar view recreations when external calendar providers are reported in a different order, and preserved Calendar scroll position when a config-driven refresh has to recreate the view. Thanks to @e-zz for reporting this.
- (#1972) Fixed ICS calendar event related notes so standalone events with similar numeric IDs no longer show unrelated notes or tasks on every event. Thanks to @ks-studio-net for reporting this.
- (#1970) Fixed generated default Base filters so updating default files applies configured excluded folders to TaskNotes task views. Thanks to @henrim01 for reporting that templates could still appear in regenerated views.
- (#1968) Fixed inline task link overlays collapsing on Obsidian mobile, which could hide the task title and leave a tall empty gap after the widget. Thanks to @renatomen for reporting and diagnosing the containment issue.
