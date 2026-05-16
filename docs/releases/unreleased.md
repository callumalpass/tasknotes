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

- ([#1754](https://github.com/callumalpass/tasknotes/issues/1754)) Added optional icons for priority values, so task cards can show a configured priority icon instead of only a colored dot. Thanks to @BrucePlumb for suggesting this and @prepare4robots for the follow-up feedback.
- ([#1761](https://github.com/callumalpass/tasknotes/issues/1761)) Added TaskNotes edit and quick-action entries to Obsidian's native file context menu for recognized task notes. Thanks to @delzero for suggesting this.
- ([#1771](https://github.com/callumalpass/tasknotes/issues/1771)) Added mobile drag handles to manually sorted Task List Bases views, so dragging can start from the handle without disabling normal text interaction on the rest of the card. Thanks to @PatrickGolz for suggesting this.
- ([#1776](https://github.com/callumalpass/tasknotes/issues/1776)) Allowed calendar timeline end times after midnight, such as `26:00` for a 2 AM next-day end. Thanks to @chrabia for suggesting this.
- ([#1784](https://github.com/callumalpass/tasknotes/issues/1784), [#1833](https://github.com/callumalpass/tasknotes/pull/1833)) Added a per-view `pinnedColumns` option for TaskNotes Kanban views, so selected empty columns can stay visible as drop targets while other empty columns remain hidden. Thanks to @loukandr for suggesting and prototyping this.
- ([#1794](https://github.com/callumalpass/tasknotes/issues/1794)) Added context updates to the task card context menu, so contexts can be added, toggled, or cleared without opening the task edit modal. Thanks to @m13ntrpn for suggesting this.
- ([#1748](https://github.com/callumalpass/tasknotes/issues/1748), [#1809](https://github.com/callumalpass/tasknotes/issues/1809)) Added a subtle task-card indicator and CSS hooks for tasks with note body details. Thanks to @yeHHH1g and @aliceinwaterdeep for suggesting this.
- ([#1808](https://github.com/callumalpass/tasknotes/issues/1808)) Added advanced Kanban swimlane ordering through `swimLaneOrder`, so swimlane rows can stay in a stable configured order. Thanks to @rookledookle for suggesting this, and to @benmartinek and @chrabia for the follow-up feedback.
- ([#1805](https://github.com/callumalpass/tasknotes/issues/1805)) Added an ICS export option to omit completed tasks from generated calendar files. Thanks to @bepolymathe for suggesting this.
- ([#1818](https://github.com/callumalpass/tasknotes/issues/1818)) Added an auto-height mode for TaskNotes Calendar Bases views so embedded agenda/list sections can size to their content instead of forcing an inner scroller. Thanks to @martin-forge for suggesting this.
- ([#1732](https://github.com/callumalpass/tasknotes/issues/1732), [#1835](https://github.com/callumalpass/tasknotes/issues/1835)) Added hotkeyable commands to edit the current task, add a project to the current task, and add an existing task as a subtask of the current note. Thanks to @prepare4robots for requesting this and @ubidev for the follow-up suggestion.

## Changed

- ([#1762](https://github.com/callumalpass/tasknotes/issues/1762)) Used the configured Google Calendar task export target as the default calendar when creating manual external calendar events. Thanks to @chrabia for suggesting this.
- ([#1774](https://github.com/callumalpass/tasknotes/issues/1774)) Made expandable project chevrons visible and easier to tap on mobile. Thanks to @sh0nuff for suggesting this.
- ([#1785](https://github.com/callumalpass/tasknotes/issues/1785)) Made the Create subtask action prefill the parent task's contexts, priority, and non-identifying tags while keeping the existing parent-task project link. Thanks to @poulpoulsen for suggesting this.
- ([#1790](https://github.com/callumalpass/tasknotes/issues/1790)) Extended the identifying-tag hiding setting to task modal tag suggestions, and kept hidden identifying tag children in place when editing other tags. Thanks to @loukandr for suggesting this.
- ([#1804](https://github.com/callumalpass/tasknotes/issues/1804)) Made the inline-created task folder setting visible even when instant conversion is disabled, and clarified that leaving it empty uses the default tasks folder. Thanks to @CaFeZn for suggesting this.
- ([#1822](https://github.com/callumalpass/tasknotes/issues/1822)) Matched the Task Edit Modal subtask list order to the existing relationship sort, so active and higher-priority subtasks appear ahead of completed ones. Thanks to @Glint-Eye for suggesting this.

## Fixed

- ([#1750](https://github.com/callumalpass/tasknotes/issues/1750)) Fixed generated default Bases filters for property-based task identification when the identifying property name contains spaces. Thanks to @Igorgro for reporting this.
- ([#1745](https://github.com/callumalpass/tasknotes/issues/1745)) Clarified the inline task documentation so `Create new inline task` is distinguished from current-line conversion. Thanks to @yvos for reporting the mismatch.
- ([#1739](https://github.com/callumalpass/tasknotes/issues/1739)) Enabled Kanban touch dragging on touch-capable desktop and convertible devices, not only mobile Obsidian. Thanks to @mgsima for reporting the tablet-mode failure.
- ([#1738](https://github.com/callumalpass/tasknotes/issues/1738)) Fixed Outlook calendar subscriptions whose event timezones reference the base Windows timezone name while the feed defines a suffixed timezone name. Thanks to @Mirrimo for reporting this, @rafavital for confirming it, and @rogerfsh for tracing the ICS timezone mismatch.
- ([#1734](https://github.com/callumalpass/tasknotes/issues/1734)) Fixed dependency picker search when task priority values are stored as non-string frontmatter values. Thanks to @MatthewClarkeDev for reporting this and identifying the stack trace.
- ([#1733](https://github.com/callumalpass/tasknotes/issues/1733)) Preserved wikilinks in task titles and rendered them as clickable links on task cards. Thanks to @bitscorch for suggesting this.
- ([#1728](https://github.com/callumalpass/tasknotes/issues/1728)) Applied the "Use parent note as project" default when creating a new task from the command palette or ribbon. Thanks to @greatEmily for reporting this.
- ([#1759](https://github.com/callumalpass/tasknotes/issues/1759)) Advanced stale due dates when recurring tasks move to their next scheduled occurrence, so work-window tasks do not remain overdue after completion. Thanks to @MattPryze for reporting this.
- ([#1766](https://github.com/callumalpass/tasknotes/issues/1766)) Fixed Calendar Bases date navigation from custom note properties, so embedded calendar views can open on the date stored in the selected property instead of falling back to today. Thanks to @chrabia for reporting this.
- ([#1767](https://github.com/callumalpass/tasknotes/issues/1767)) Aligned the start and end time rows in the timeblock creation modal. Thanks to @loiveli for reporting this.
- ([#1783](https://github.com/callumalpass/tasknotes/issues/1783)) Replaced the default browser drag ghost for Kanban cards so dragging a card no longer makes the next card look semi-transparent. Thanks to @loukandr for reporting this and tracing the drag image behavior.
- ([#1796](https://github.com/callumalpass/tasknotes/issues/1796)) Restored expanded subtasks immediately after renaming a parent task file and updating links. Thanks to @bung69 for reporting this.
- ([#1797](https://github.com/callumalpass/tasknotes/issues/1797)) Improved Kanban manual ordering so long columns remain scrollable while dragging, and mobile drops can place a card relative to another card in the column. Thanks to @SKIERZZ for reporting this and sharing videos.
- ([#1811](https://github.com/callumalpass/tasknotes/issues/1811)) Restored dragging inline task widgets onto Calendar views to schedule them, matching the earlier external-drop workflow. Thanks to @ghake for reporting the regression.
- ([#1812](https://github.com/callumalpass/tasknotes/issues/1812)) Separated Microsoft OAuth token status from calendar sync status, and surfaced Microsoft calendar fetch errors in the integrations settings card instead of leaving them console-only. Thanks to @henninger80 for the detailed report.
- ([#1814](https://github.com/callumalpass/tasknotes/issues/1814)) Restored NLP project autosuggest in the Create or Open Task command, so `+` project suggestions use the same filtered project lookup as the Create Task modal. Thanks to @adammahad for reporting this.
- ([#1820](https://github.com/callumalpass/tasknotes/issues/1820)) Kept API-created tasks readable immediately after creation even if Obsidian has not finished indexing the new file metadata yet. Thanks to @vadminas for reporting and tracing the cache desync.
- ([#1823](https://github.com/callumalpass/tasknotes/issues/1823)) Prevented zero-duration timed external calendar events from rendering under more than one day in list-style calendar views. Thanks to @martin-forge for reporting and tracing the Google Calendar case.
- ([#1841](https://github.com/callumalpass/tasknotes/issues/1841)) Prevented Kanban boards from duplicating columns when wikilinked status values are grouped through Bases. Thanks to @lendamico for reporting and sharing the screen recording.
- ([#1846](https://github.com/callumalpass/tasknotes/issues/1846)) Saved NLP-triggered boolean custom fields as real booleans instead of quoted strings, so they match checkbox-created values and Bases filters. Thanks to @DevOps-Toast for reporting and sharing screenshots.
- ([#1849](https://github.com/callumalpass/tasknotes/issues/1849)) Prevented repeated clicks on task-card scheduled and due date labels from stacking duplicate date menus when Obsidian native menus are disabled. Thanks to @3zra47 for reporting.
- ([#1850](https://github.com/callumalpass/tasknotes/issues/1850)) Added mobile bottom spacing to TaskNotes list views so the final task can scroll above Obsidian's floating mobile controls. Thanks to @AlejandroRigau for reporting and sharing the iPhone screenshot.
- ([#1852](https://github.com/callumalpass/tasknotes/issues/1852)) Improved mobile timed calendar event rendering with shorter time labels, tighter spacing, and event-colored task/calendar blocks. Thanks to @redrumthebum for reporting and sharing screenshots.
- ([#1757](https://github.com/callumalpass/tasknotes/issues/1757), [#1853](https://github.com/callumalpass/tasknotes/issues/1853), [#1775](https://github.com/callumalpass/tasknotes/pull/1775)) Respected an existing `mdbase.yaml` `types_folder` when regenerating mdbase task type definitions, so the generated `task.md` can live outside the vault-root `_types` folder. Thanks to @aldrichtr for the original request and implementation exploration, and @hangryscribe3 for the follow-up request.
- ([#1858](https://github.com/callumalpass/tasknotes/issues/1858)) Included task body details in single-task HTTP API and MCP reads. Thanks to @vanillaflava for reporting and outlining the expected behavior.
- ([#1859](https://github.com/callumalpass/tasknotes/issues/1859)) Clarified the Google Calendar setup guide for OAuth testing-mode `access_denied` errors. Thanks to @PE-Boy for reporting and @tiagoarroz for the workaround.
- ([#1860](https://github.com/callumalpass/tasknotes/issues/1860)) Preserved accented characters in tags when converting checkbox tasks to TaskNotes. Thanks to @e-zz for reporting.
- ([#1869](https://github.com/callumalpass/tasknotes/issues/1869)) Preserved Calendar Month View scroll position after task updates. Thanks to @sisyowo for reporting and linking the earlier Kanban fix.
- ([#1873](https://github.com/callumalpass/tasknotes/issues/1873)) Fixed calendar resizing during pop-out and embedded view transitions so Obsidian no longer freezes while the calendar is being moved. Thanks to @misolex for reporting.
- ([#1870](https://github.com/callumalpass/tasknotes/issues/1870)) Fixed NLP file suggestions for list-type custom fields so selected wikilinks are captured as custom field values. Thanks to @Sineapple for reporting and @Xananax for the follow-up details.
- (#1888) Allowed project autosuggest required property filters to match any comma-separated value, such as `project, area`. Thanks to @BrianHicks for suggesting.
- ([#1886](https://github.com/callumalpass/tasknotes/issues/1886)) Added a command to postpone active overdue scheduled tasks to today. Thanks to @chrabia for the suggestion.
- (#1889) Fixed Kanban swimlanes for list-valued properties so tags and contexts use individual list items instead of comma-joined values. Thanks to @pkropotin for reporting.
- (#1890) Fixed scheduled-date Kanban columns dropping tasks when date-only and timed tasks on the same day are sorted by a scheduled-time formula. Thanks to @chrabia for reporting and investigating.
- (#1892) Fixed nested Markdown list indentation in the Task Edit Modal details editor. Thanks to @Glint-Eye for reporting.
- (#1891) Fixed TaskNotes modal markdown editors collapsing to one-character-wide lines when Pretty Properties is installed. Thanks to @bkennedy-improving for reporting.
- Restored padding in task modal Markdown editors.
- Made the markdown editor areas in task modals easier to click and focus.
- Strengthened local CSS linting to catch unscoped selectors, unknown CSS, and fixed-position overlays before review.
- Reduced false-positive plugin review warnings by making background auto-export and auto-archive schedulers non-overlapping and tightening type/string conversion paths.
