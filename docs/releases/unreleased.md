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

- ([#648](https://github.com/callumalpass/tasknotes/issues/648), [#1605](https://github.com/callumalpass/tasknotes/issues/1605)) Added clickable links in task-card contexts for note links, markdown links, and web URLs while keeping plain contexts as tag-search buttons. Thanks to @trdischat and @Glint-Eye for suggesting this, and to @renatomen for the follow-up feedback.
- ([#1603](https://github.com/callumalpass/tasknotes/issues/1603)) Added Calendar view toggles for hiding completed or skipped recurring task instances while keeping future outstanding instances visible. Thanks to @wandererovertheseaofpiss for suggesting this.
- ([#1625](https://github.com/callumalpass/tasknotes/issues/1625)) Added `Shift` + `Cmd`/`Ctrl` + `Enter` in the Create Task modal to save the current task and reopen the modal for the next one. Thanks to @tcb678 for suggesting this.
- ([#1641](https://github.com/callumalpass/tasknotes/issues/1641)) Added support for list-valued property-based Calendar start and end dates, so one note can render multiple property events without extra view settings. Thanks to @jhoogeboom for suggesting this.
- ([#1664](https://github.com/callumalpass/tasknotes/pull/1664)) Added project-based custom filename template variables, including the first project, all projects, and a short `projectId`. Thanks to @bendavis987 for the contribution.
- ([#1697](https://github.com/callumalpass/tasknotes/issues/1697)) Added cached Google Calendar, Microsoft Calendar, and ICS events to Mini Calendar days, with compact colored dots and event details from the existing calendar connection. Thanks to @RPGArchivist for suggesting this.
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
- ([#1655](https://github.com/callumalpass/tasknotes/issues/1655)) Added live elapsed time to the optional active time tracking status bar item. Thanks to @connradolisboa for suggesting this.
- ([#1622](https://github.com/callumalpass/tasknotes/issues/1622)) Allowed multiple comma-separated default reminder offsets for timed Google Calendar task exports. Thanks to @solidabstract for suggesting this.
- ([#706](https://github.com/callumalpass/tasknotes/issues/706), [#820](https://github.com/callumalpass/tasknotes/issues/820), [#1040](https://github.com/callumalpass/tasknotes/issues/1040)) Added direct Pomodoro duration editing, hour-aware timer formatting, clearer one-minute controls, and an optional active Pomodoro status bar countdown. Thanks to @SublunarSage, @lj1446615403-cloud, @0-BSCode, and @thestrike72 for the suggestions and feedback.
- Added a generated Pomodoro statistics Base with daily and monthly summary views for Pomodoro history stored in daily notes.

## Changed

- Added guidance in Pomodoro statistics and Base file settings explaining that Pomodoro Base views require daily notes storage.
- Improved keyboard access, mobile layout, and theme color consistency across task cards, TaskNotes Kanban, Bases Kanban, calendar controls, stats, settings, and filter popovers.
- ([#1642](https://github.com/callumalpass/tasknotes/issues/1642)) Made completion-based custom recurrence use flexible weekly, monthly, and yearly intervals without forcing a fixed weekday, month day, or month. Thanks to @Volker-brdb for suggesting this.
- ([#1724](https://github.com/callumalpass/tasknotes/issues/1724)) Moved recurring task complete/skip instance actions into the date area of the task context menu. Thanks to @prepare4robots for suggesting this.
- ([#1762](https://github.com/callumalpass/tasknotes/issues/1762)) Used the configured Google Calendar task export target as the default calendar when creating manual external calendar events. Thanks to @chrabia for suggesting this.
- ([#1774](https://github.com/callumalpass/tasknotes/issues/1774)) Made expandable project chevrons visible and easier to tap on mobile. Thanks to @sh0nuff for suggesting this.
- ([#1710](https://github.com/callumalpass/tasknotes/issues/1710), [#1785](https://github.com/callumalpass/tasknotes/issues/1785)) Made the Create subtask action prefill the parent task's projects, contexts, priority, and non-identifying tags while keeping the parent-task project link. Thanks to @Jalpara and @poulpoulsen for reporting this, and to @hokfujow for the follow-up feedback.
- ([#1790](https://github.com/callumalpass/tasknotes/issues/1790)) Extended the identifying-tag hiding setting to task modal tag suggestions, and kept hidden identifying tag children in place when editing other tags. Thanks to @loukandr for suggesting this.
- ([#1804](https://github.com/callumalpass/tasknotes/issues/1804)) Made the inline-created task folder setting visible even when instant conversion is disabled, and clarified that leaving it empty uses the default tasks folder. Thanks to @CaFeZn for suggesting this.
- ([#1822](https://github.com/callumalpass/tasknotes/issues/1822)) Matched the Task Edit Modal subtask list order to the existing relationship sort, so active and higher-priority subtasks appear ahead of completed ones. Thanks to @Glint-Eye for suggesting this.

## Fixed

- Made TaskNotes Kanban drags show a lightweight held-card preview, so the dragged card remains easy to track while the source column opens the drop slot.
- ([#1587](https://github.com/callumalpass/tasknotes/issues/1587)) Stored dependencies added from the task context menu as wikilinks, matching the Edit Task modal. Thanks to @mgrecar for reporting this.
- ([#1590](https://github.com/callumalpass/tasknotes/issues/1590)) Clarified HTTP API task creation docs and OpenAPI schema for writable `blockedBy` dependencies, and marked `blocking` as a read-only derived relationship. Thanks to @hGriff0n for reporting this.
- ([#1591](https://github.com/callumalpass/tasknotes/issues/1591)) Added a startup guard that avoids saving default settings over an existing settings file if Obsidian temporarily returns no plugin data during an update. Thanks to @GGlider for reporting this.
- ([#1593](https://github.com/callumalpass/tasknotes/issues/1593)) Made the New button in TaskNotes Bases views open the TaskNotes create task modal again, so new tasks respect the configured default tasks folder. Thanks to @katlandreth for reporting this.
- ([#1594](https://github.com/callumalpass/tasknotes/issues/1594)) Made task cards inside recurring task notes complete the task's current scheduled occurrence instead of today's date when no calendar or view date is supplied. Thanks to @ngraham20 for reporting this.
- ([#1601](https://github.com/callumalpass/tasknotes/issues/1601)) Prevented overlapping Live Preview relationship-widget injections from leaving duplicate subtask/relationship sections in a note. Thanks to @wealthychef1 for reporting this and @benmartinek for confirming it.
- ([#1610](https://github.com/callumalpass/tasknotes/issues/1610)) Made expanded subtasks in TaskNotes Bases views follow the current view's sorted task order instead of a fixed fallback order. Thanks to @MrZzard for reporting this and @slipstyle for confirming it.
- ([#1609](https://github.com/callumalpass/tasknotes/issues/1609)) Restored scrolling in wide split-layout task edit modals when the form content is taller than the modal. Thanks to @3zra47 for reporting this.
- ([#1614](https://github.com/callumalpass/tasknotes/issues/1614)) Wrote unchecked boolean custom user-field defaults to new task frontmatter, including tasks created through instant conversion. Thanks to @kobalteule for reporting this.
- ([#1611](https://github.com/callumalpass/tasknotes/issues/1611)) Made generated default Bases urgency scores fall back safely when the next-date distance is missing. Thanks to @benoitjadinon for reporting this and suggesting the formula fix.
- ([#1623](https://github.com/callumalpass/tasknotes/issues/1623)) Honored "Store title in filename" across task creation and edits, so the mapped title property is omitted from frontmatter and stale title fields are removed on save. Thanks to @VenturaNotes for reporting this, and to @Ender367, @slipstyle, and @loukandr for confirming and tracing affected paths.
- ([#1621](https://github.com/callumalpass/tasknotes/issues/1621)) Made Kanban swimlane labels stop freezing on mobile and kept their label column compact, leaving more room for task cards while horizontally scrolling. Thanks to @karenchoe428 for reporting this.
- ([#1615](https://github.com/callumalpass/tasknotes/issues/1615)) Detected Obsidian custom multi-text properties exposed through `widget: "multitext"` as list properties, so Kanban can split those values into multiple columns. Thanks to @konton71 for reporting this.
- ([#1626](https://github.com/callumalpass/tasknotes/issues/1626)) Expanded recurring ICS subscription events through the one-year subscription window for high-frequency recurring calendars. Thanks to @pib for reporting this.
- ([#1628](https://github.com/callumalpass/tasknotes/issues/1628)) Refreshed Calendar Bases views promptly when switching between filtered Agenda views, so the previous view's task set does not stay visible until the delayed refresh. Thanks to @Lanalangz for reporting this.
- ([#1629](https://github.com/callumalpass/tasknotes/issues/1629)) Saved `blockedBy` dependencies selected in the Create Task modal. Thanks to @obsilover for reporting this.
- ([#1634](https://github.com/callumalpass/tasknotes/issues/1634)) Aligned custom status icons in inline tasks with the default inline status circle. Thanks to @ttlaylor for reporting this and @basbarten for confirming it.
- ([#1636](https://github.com/callumalpass/tasknotes/issues/1636)) Restored the active styling for the Calendar list-view toolbar button. Thanks to @vroablec for reporting this.
- ([#1638](https://github.com/callumalpass/tasknotes/issues/1638)) Kept task time tracking consistent when switching or clearing tasks during an active Pomodoro. Thanks to @katonapng for reporting this and @anomatomato for confirming it.
- ([#1639](https://github.com/callumalpass/tasknotes/issues/1639)) Respected the aliased-link overlay exclusion in Reading mode even when the alias text matches the task title. Thanks to @MiracleXYZ for reporting this.
- Fixed actively tracked task cards so the blue time-tracking outline stays visible along the card edges.
- ([#1657](https://github.com/callumalpass/tasknotes/issues/1657)) Preserved Bases view defaults when creating tasks from the TaskNotes Kanban/List view New button, so project-scoped views can pass their project assignment into the create task modal. Thanks to @casualQuads122 for reporting this.
- ([#1662](https://github.com/callumalpass/tasknotes/issues/1662)) Preserved frontmatter from ICS event note templates when quoted event variables or Templater expressions are used. Thanks to @victorhg for reporting this.
- ([#1663](https://github.com/callumalpass/tasknotes/issues/1663)) Fixed Japanese and other Unicode tags on task cards so Kanban tag pills keep the same rounded styling as ASCII tags. Thanks to @kutty-1119 for reporting this.
- ([#1649](https://github.com/callumalpass/tasknotes/issues/1649)) Restored daily-note navigation from the Calendar Day view date header. Thanks to @BaccanoMob for reporting this.
- ([#1648](https://github.com/callumalpass/tasknotes/issues/1648), [#1665](https://github.com/callumalpass/tasknotes/issues/1665)) Fixed the API endpoint list in Integrations settings so it uses the configured bearer token when API authentication is enabled, instead of reporting the running local server as inaccessible. Thanks to @npondel and @warm-july for reporting this.
- ([#1668](https://github.com/callumalpass/tasknotes/issues/1668)) Fixed the Create Task magic wand so NLP-triggered custom field values are copied into the custom property inputs before saving. Thanks to @hokfujow for reporting this.
- ([#1669](https://github.com/callumalpass/tasknotes/issues/1669)) Stopped the startup settings migration check from rewriting `data.json` just because saved calendar defaults are `false`, `0`, empty, or `null`, reducing unnecessary sync churn. Thanks to @thehyperadvisor for reporting this.
- ([#1674](https://github.com/callumalpass/tasknotes/issues/1674)) Improved the timeblock creation error when Daily Notes cannot read its configured folder, so the modal notice points to the Daily Notes core plugin settings instead of only logging the folder lookup failure. Thanks to @Ender367 for reporting this.
- ([#1680](https://github.com/callumalpass/tasknotes/issues/1680)) Fixed TaskNotes Calendar Bases options stored under `options`, so Agenda views respect `showPropertyBasedEvents: false` and no longer show duplicate property-based rows for the same task. Thanks to @xiaoyaozhu1991 for reporting this and @KondrotM for confirming it.
- ([#1681](https://github.com/callumalpass/tasknotes/issues/1681)) Reduced the cost of inline checkbox convert buttons by only scanning the visible editor range instead of the full document. Thanks to @en-ot for reporting this.
- ([#1689](https://github.com/callumalpass/tasknotes/issues/1689)) Fixed task reminders added or rescheduled through direct frontmatter edits so the notification queue refreshes immediately and relative reminders recalculate from the latest task dates. Thanks to @garzonjav for reporting this.
- ([#1693](https://github.com/callumalpass/tasknotes/issues/1693)) Fixed generated default Bases formulas so empty due and scheduled dates are checked with `.isEmpty()` instead of date-field truthiness. Thanks to @benoitjadinon for reporting this.
- ([#1702](https://github.com/callumalpass/tasknotes/issues/1702)) Removed the forced bottom gap under TaskNotes custom Bases views, so calendar and other TaskNotes views can fill the available pane height. Thanks to @AudreyLooby for reporting this.
- ([#1719](https://github.com/callumalpass/tasknotes/issues/1719)) Fixed task cards in reading mode so Obsidian 1.12.x header changes no longer place the card above the title and properties or drop it after returning to a tab. Thanks to @tholbrook9 for reporting this and tracing the DOM change.
- ([#1722](https://github.com/callumalpass/tasknotes/issues/1722)) Saved the source note immediately after converting an inline checkbox task to a TaskNote, so Kanban views do not keep showing the stale inline task alongside the new task file. Thanks to @literallydope for reporting this and sharing screenshots.
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
- ([#136](https://github.com/callumalpass/tasknotes/issues/136)) Made the Pomodoro countdown derive remaining time from the session clock instead of from counted interval ticks, so delayed or backgrounded ticks catch up cleanly without over-recording a completed session. Thanks to @Poly-0000 for reporting and documenting the original background timer issue, and @Totobal5 for the earlier worker-based fix.
- Restored padding in task modal Markdown editors.
- Made the markdown editor areas in task modals easier to click and focus.
- Strengthened local CSS linting to catch unscoped selectors, unknown CSS, and fixed-position overlays before review.
- Reduced false-positive plugin review warnings by making background auto-export and auto-archive schedulers non-overlapping and tightening type/string conversion paths.
