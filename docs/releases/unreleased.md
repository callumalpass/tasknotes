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

## Fixed

- (#1713) Fixed ICS export so date-only scheduled tasks are emitted as proper all-day events instead of midnight-timed events, improving compatibility with calendar apps like Thunderbird and Evolution
  - Thanks to @bepolymathe for the feature request and clear calendar interoperability report
- (#267, #948, #1682, #1717, #1725) Fixed expanded subtasks and dependency cards in Bases Task List and Kanban views so related items can inherit the current view's filters instead of always showing every linked task, and added a per-view "Expanded relationships" option to switch between inheriting filters and showing all related tasks
  - Thanks to @mdbraber, @GardarikanetS, @Glint-Eye, @prepare4robots, and @robmcphers0n for the reports and feature requests that surfaced the same filtering gap from different angles
- Improved custom view and search-pane activation reliability by using Obsidian's deferred-leaf APIs when revealing existing leaves, so TaskNotes waits for deferred tabs to load before interacting with them
- Refactored internal plugin bootstrap, main plugin coordination, command registration, workspace navigation, settings lifecycle, task mutation flows, filter query planning, Bases adapter boundaries, and task card/modal helper modules to reduce coupling and make future maintenance safer, including extraction of modal editor and organization/dependency field setup helpers
- (#1720) Fixed Bases Task List cards showing Lucide icon tokens such as `clock` instead of formatted date-like values, and fixed generic property labels to use configured Bases display names instead of raw property IDs
  - Thanks to @Sirnii for reporting
- (#1633) Fixed interactive Task Card labels and ribbon labels so Bases-backed cards use translated labels and configured Bases display names instead of hardcoded English/raw property IDs
  - Thanks to @Sarryaz for reporting
- (#1651) Fixed date `is` query filtering so date-only searches also match timed `scheduled` and `due` values during TaskManager prefiltering
  - Thanks to @36mimu36 for reporting
- (#1644) Fixed generated default task views so recurring tasks without a `complete_instances` property are still treated as incomplete and appear in views like This Week, Today, and Overdue
  - Thanks to @bkennedy-improving for reporting
- Updated generated `_types/task.md` mdbase schema output so `dateCreated` and `dateModified` include generated values (`now` and `now_on_write`) for automatic timestamp handling on create/write
- (#1513, #1686) Fixed a calendar view issue where creating or modifying events, timeblocks, etc. could reset the visible date back to today
  - Preserves the visible date for in-place calendar recreation without overriding explicit initial-date navigation settings
  - Thanks to @Lorite for the fix
- Fixed documentation deployment CI failures caused by `docs-builder/src/js/main.js` being excluded by a broad `.gitignore` `main.js` rule
  - Added a specific unignore rule so the docs site client script is tracked and available in GitHub Actions builds
- Reduced long-running performance risk from calendar sync token persistence by avoiding full runtime settings side-effects during background sync writes
- Prevented duplicate auto-stop time tracking listeners from accumulating when settings are reloaded or changed
- Fixed a settings Integrations listener lifecycle issue that could accumulate calendar update callbacks while the settings UI is repeatedly opened/re-rendered
- (#1630) Fixed TaskNote inline task cards ignoring centered "Readable line length" layout in Minimal theme by constraining and centering the widget in readable mode
  - Thanks to @martin-forge for reporting
- Consolidated documentation cleanup for accuracy and clarity across API, webhook, NLP, privacy, settings, and view docs (corrected outdated endpoint/behavior details, normalized current settings paths, and tightened non-release prose)
- Fixed a broken docs cross-reference from Property Types Reference to Task Properties settings
- Fixed docs site link generation so internal Markdown links resolve to route URLs instead of broken `.md` paths (for example `/views/default-base-templates/`)
- Fixed docs release-note links by building all Markdown docs pages, including pages not listed directly in sidebar nav

## Added

- Added TaskNotes Obsidian CLI commands for task creation, time tracking, and Pomodoro control, with shared NLP-to-task conversion across CLI, modal, and API capture flows plus explicit override flags for title, details, dates, tags, contexts, projects, recurrence, recurrence anchor, reminders, estimate, literal-title capture, task-targeted start/stop time tracking, active time-status reporting, action-based Pomodoro automation, and dedicated user documentation for the built-in Obsidian CLI surface
- (#1716) Added roomier TaskCard rendering for subtasks and dependency lists inside the task modal, keeping the task options menu while reducing extra card chrome compared with full default cards
  - Thanks to @hokfujow for the feature request
- (#1619, #386, #621) Added drag-to-reorder for Kanban and Task List views, including grouped Task List moves, manual ordering support via the `tasknotes_manual_order` property, updated generated `.base` templates, and polished drag/drop feedback for swimlanes, filtered views, and interactive task controls
  - Thanks to @ac8318740 for the original contribution in PR #1619
  - Thanks to @iholston and @dsebastien for opening #386 and #621
  - Thanks to @kanzaki1201 for the swimlane drag-order discussion in #1474 that helped shape the follow-up robustness work
- Published the [TaskNotes Specification](https://github.com/callumalpass/tasknotes-spec) as a standalone repo, formalizing the rules for task data model, field mapping, temporal semantics, recurrence, operations, validation, and conformance that TaskNotes and other implementations follow
  - The spec includes an executable conformance suite with ~5,000 JSON test fixtures that any implementation can run against
  - Documentation site now includes a [Specification section](/spec/) with the full spec content
- Released [tasknotes-tui](https://github.com/callumalpass/tasknotes-tui), a terminal UI for managing TaskNotes vaults, built in Rust on top of mdbase-rs
  - Keyboard-driven interface with configurable views, date navigation, time tracking, recurring task support, and a fuzzy command palette
  - Spec-compliant: reads and writes the same markdown task files as the Obsidian plugin
