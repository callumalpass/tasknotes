# Changelog

All notable changes to this TaskNotes fork will be documented in this file.

This fork (`cybersader/tasknotes`) adds bulk tasking, notifications, and other enhancements to the upstream [TaskNotes](https://github.com/callumalpass/tasknotes) plugin.

## [4.3.59] - 2026-03-24

### Added
- **Property migration prompts for all property cards**: Changing any property key in Task Properties settings now shows a migration dialog with file count and migrate/skip/cancel options. Previously only Type, Creator, and Assignee had this.
- **Property autocomplete in migration command**: The "Migrate frontmatter properties" command palette modal now shows autocomplete suggestions from existing vault property keys when typing in the "Current property key" and "Property name" fields.

### Fixed
- **Settings property key change didn't update card header**: Changing a property key in Task Properties didn't update the subtitle shown on the collapsed card. All property cards now update their header text immediately.
- **Calendar recurring task drag-and-drop**: Dragging a pattern instance to a different date now correctly updates both the DTSTART date in the recurrence rule and the scheduled date. Previously only the time component was updated, making date drags a no-op.
- **Calendar "+more" blocks navigation**: Clicking "+X more" on crowded calendar days now navigates to the day view instead of opening a blocking popover.
- **Settings navigation to Person preferences**: The "Team & Attribution → Person preferences" link in global reminders now scrolls directly to the Person Reminder Preferences section with a highlight animation.

### Improved
- **Renamed "Store title in filename" → "Use title as filename"**: Clearer label across all 9 languages. The setting controls whether filenames use just the title (recommended) or the configured format with zettel/timestamp prefix.
- **Reminders docs restructured**: Three-tier explanation (per-task, default, global) with callouts, comparison table, and screenshot placeholders. Clearly distinguishes what gets written to files vs evaluated at runtime.
- **Docs asset reorganization**: ~70 image/GIF files moved from docs/assets root into feature-specific subdirectories. 28 auto-generated filenames renamed to descriptive names. All Obsidian wikilink embeds converted to standard markdown image syntax for mkdocs compatibility.

## [4.3.58] - 2026-03-24

### Fixed
- **Reminder modal crash on "Manage all reminders"**: Opening the reminder modal for tasks with legacy reminder format (numeric offset + unit + direction fields) caused `TypeError: offset.startsWith is not a function`. Added normalization in FieldMapper to convert legacy `{offset: 2, unit: "hours", direction: "before"}` to ISO 8601 `{offset: "-PT2H"}` at parse time, plus defensive handling in the modal's `formatOffset()`.

## [4.3.57] - 2026-03-11

### Added
- **Note vs task differentiation in card views**: Task cards in TaskList, Kanban, and Calendar views now show a muted file-text icon for non-task items instead of a status dot and priority indicator. Tasks render identically to before. Uses the existing `isTask` detection from the task identification settings.
- **Core card property injection**: TaskList, Kanban, and Calendar views now defensively inject `status`, `priority`, and `due` into `visibleProperties` regardless of `.base` file `order:` config, ensuring task cards always render essential fields.

### Fixed
- **Bulk tasking button missing from Upcoming View**: The toolbar injector checked the wrong DOM ancestor for the `tasknotes-view-active` class. Now uses `.closest()` to walk up the tree correctly.
- **Settings "Configure" links targeting wrong property card**: Creator and Assignee "Configure" links in Team Attribution settings now navigate to the correct property card instead of always landing on the Type property.
- **Quick assign not showing checked state**: Right-click quick assign menu now correctly detects existing assignees regardless of format (wikilinks, full paths, display names, aliases).
- **Duplicate assignee entries**: Added three-layer deduplication to prevent duplicate assignee values in frontmatter — in the PersonGroupPicker wikilink converter, the TaskService custom frontmatter writer, and the context menu toggle.
- **Convert-to-task formula metadata disappearing**: Task card signature now includes `isTask` flag and formula cache values, ensuring cards re-render when formulas settle after Bases re-indexes converted files.
- **Formula computation was a no-op**: `computeFormulas()` in TaskListView and KanbanView was accessing `this.data.ctx.formulas` (always undefined) instead of `this.controller.ctx.formulas`.
- **Converted files ignored by view refresh**: `onDataUpdated()` now always updates `relevantPathsCache` so newly converted files are recognized immediately.

### Improved
- **Docs updates**: Updated documentation for bulk tasking, upcoming view, kanban view, calendar views, task list, and shared vault settings with new screenshots and GIFs.

## [4.3.56] - 2026-02-26

### Fixed
- **Convert to task saves without requiring field changes**: Opening the Edit Task modal via "Convert to task" (from Bases view or command palette) and hitting Save without modifying any field now correctly writes the task identification property. Previously it showed "No changes" and closed without converting.
- **Toast notification collapse after "+X more"**: Expanding the notification items list and clicking "+X more" no longer prevents the collapse toggle from working. The scrollable CSS class now respects the expand/collapse state.

## [4.3.55] - 2026-02-25

### Added
- **Upcoming View: group by scheduled date**: New "Group by date" dropdown in the Upcoming View's Configure panel lets you switch between grouping by due date (default) or scheduled date. Tasks are categorized into the same time buckets (Overdue, Today, Tomorrow, etc.) based on whichever date field you choose.
- **Reschedule targets active date field**: When grouping by scheduled date, single-task reschedule and bulk reschedule both modify the scheduled date instead of the due date.
- **Row 2 shows the "other" date**: Cards display the non-grouping date on the second row (e.g., when grouping by scheduled, the due date appears with a calendar icon, and vice versa).
- **Add task pre-populates correct field**: The "+" button in each time category pre-fills the scheduled or due date based on the active grouping mode.
- **PropertyPicker conversion progress bar**: Type conversion now shows a live progress bar inside the confirmation modal instead of closing immediately.

### Fixed
- **Edit Task modal shows field overrides on open**: Tasks with per-task field mappings (e.g., `tnDueDateProp: convert_test`) now auto-populate the Remap Properties section when the Edit Task modal opens, instead of requiring manual re-add via search.
- **Bulk generation writes field override tracking properties**: When mapping a custom property to a core field (e.g., `convert_test` to Due date) in the bulk generate modal, the tracking property (`tnDueDateProp`) is now correctly written to generated task files.
- **Duplicate "Bulk tasking" button**: Toggling "Show toolbar buttons" in Bases view configure panel no longer creates duplicate buttons.

### Removed
- **Stale test-fixtures folder**: Removed static fixture files from the repo — the test fixtures plugin generates these dynamically now.

## [4.3.53] - 2026-02-25

### Added
- **Popover panels for bulk modal**: Assignees and Remap Properties now use floating popover panels instead of inline expand sections. Popovers stay inside Obsidian's modal focus trap, dismiss on outside click or Escape.
- **Settings cross-link**: "Modal layout" entry in Appearance tab links directly to the Modal Fields settings tab.

### Improved
- **PropertyPicker floating menus**: Conversion, type-conversion, and affected-files sub-menus now float above the modal instead of being clipped by scroll containers. Viewport-aware positioning flips menus above when near the bottom edge.
- **Shorter menu labels**: "Convert N files to date" → "Fix N → date", "Create key_type copy" → "Duplicate with suffix '_type'", "Show affected files" → "View N files". Full descriptions available via hover tooltip.
- **Back button on files list**: "← Back" button at the top of the affected files list returns to the conversion menu.
- **View defaults spacing**: Removed double spacing (margin + flex gap) in bulk modal view-settings tab.
- **Property mapping collapsed by default**: The "Remap properties" section now starts hidden in Edit and Create modals. Click the list-plus icon to reveal it.

### Fixed
- **Setting description clarity**: "Hide property mapping by default" now explains it only affects Edit/Create modals — the bulk modal always uses a popover.

### Removed
- ~170 lines of dead code: old inline rendering methods replaced by the popover system.

## [4.3.52] - 2026-02-24

### Fixed
- **User field ordering in Edit modal**: Custom user fields (e.g., "TEST") no longer appear between Creator and Assignees. Fallback person pickers now insert into the correct group container alongside registered person fields.
- **"Shared vault" label mismatch**: PersonGroupPicker empty state and configure link now say "Team & Attribution" to match the actual settings tab name. Tab navigation selector also corrected.

## [4.3.51] - 2026-02-24

### Fixed
- **Edit modal not loading assignee**: Assignee field appeared empty in the Edit Task modal even when the task had an assignee in frontmatter. Root cause: `initializeUserFields()` only loaded registered user fields, but the fallback PersonGroupPicker for core fields (assignee/creator) read from the same map. Now pre-loads core assignee/creator values from frontmatter so fallback pickers always find existing data.

### Changed
- **Docs overhaul (in progress)**: Rewrote workflows page with four-mode knowledge work taxonomy (Records & Registers, Capture & Execute, Orchestration, Rhythm & Habits). Updated index page, views page cleanup, mkdocs nav fix. Original developer walkthroughs preserved with foldable use case examples.
- **Test fixtures aligned to plugin defaults**: Renamed view `.base` files from Title Case to `*-default.base` naming to match plugin auto-created defaults. Added 4 workflow demo `.base` files. Enriched test data with capture/rhythm tasks and recurring task completion history.

## [4.3.50] - 2026-02-24

### Improved
- **Debug logging settings UX**: Collapsed all debug options behind a single "Enable debug logging" toggle. When OFF, just one line. When ON, expands to show destination checkboxes (File / Console), category filters, and clear button in an indented panel. Independent file and console toggles — use either or both.

## [4.3.49] - 2026-02-24

### Added
- **Granular debug log controls**: New per-category filter checkboxes under Developer Options let you enable/disable logging for specific subsystems (Notifications, Views, Bulk operations, Services, etc.) instead of all-or-nothing.
- **Clearer debug logging description**: Setting now explains that ON sends logs to both console and debug.log file, while OFF silences everything except errors.

### Changed
- **Migrated ~170 raw console.log/warn calls to debugLog**: Logs from 41 source files now respect the debug logging toggle and category filters. Console is quiet by default — only errors show unless debug logging is explicitly enabled.

### Fixed
- **DebugLog ENOENT crash**: Deleting `debug.log` while logging was enabled caused repeated ENOENT errors. Now gracefully recreates the file when the cached reference is stale.

## [4.3.48] - 2026-02-24

### Fixed
- **Toolbar buttons disappearing on toggle**: Fixed race condition where toggling "Show toolbar buttons" off/on on TaskNotes views caused the "New task" button to vanish. Root causes: (1) old view cleanup removing buttons the new view just injected during Bases re-mount, (2) toggle handler using stale DOM references after YAML save. Now uses deferred cleanup with re-claim detection and YAML-based view type identification instead of fragile DOM class checks.
- **Docs-builder Mermaid diagrams**: Fixed "Syntax error in text" caused by copy-button script appending a `<button>` child to `<pre class="mermaid">` elements, corrupting diagram content. Excluded Mermaid blocks from copy-button injection.
- **Duplicate toolbar buttons on table views**: Made button injection idempotent — always cleans up existing buttons before inserting new ones to handle Bases DOM reuse.

### Documentation
- Docs-builder: added Mermaid diagram support (CDN rendering, dark/light theme integration, dedicated CSS).
- Docs-builder: added callout/admonition rendering with icons for note, tip, warning, caution, and abstract types.
- New development docs: architecture overview, testing guide, writing-docs guide.

## [4.3.47] - 2026-02-20

### Added
- **Creator/Assignee visibility callout**: Creator and Assignee cards in Task Properties settings now show a warning callout when the field is disabled or hidden in Modal Fields, with one-click "Enable" / "Show in all modals" fix buttons and a link to the Modal Fields tab.
- **Self-healing person field sync**: Plugin load now auto-repairs missing Creator/Assignee entries in `modalFieldsConfig` — fixes silent data desync from migration edge cases or settings corruption.
- **Notice warnings in Modal Fields**: Disabling or hiding a Creator/Assignee field in the Modal Fields manager now shows a Notice explaining the consequence and where to re-enable.
- **Human-readable Modal Fields cards**: User field cards in Modal Fields now show display name and property key instead of opaque internal IDs like `creator-1234567890`.
- **Discovery UX improvements**: Team & Attribution "Show details" section now shows colored avatar initials, collapsible People/Groups sections with localStorage persistence, inline group member names, and actionable empty states.
- **Bulk Edit Tasks tab**: Bases view toolbar now includes a "Bulk edit" button that opens the Bulk Task Creation modal pre-populated with all view items for batch property edits.

### Fixed
- **Creator missing from Edit Task modal**: Fixed fallback person pickers not rendering when the Creator field existed in user fields but was disabled in Modal Fields configuration. The fallback now checks modal field visibility before deciding whether to render.
- **Duplicate assignees in task creation**: Fixed duplicate entries appearing in assignee arrays when creating tasks with PersonGroupPicker.

### Documentation
- **Full documentation overhaul**: 26 doc pages rewritten with accurate feature descriptions, cross-links, and breadcrumb navigation.
- **24 screenshots**: Captured clean UI screenshots for views, settings, modals, features, and content types.
- **New doc pages**: Contributing guide, bulk tasking, shared vault, custom properties, per-base mapping, property migration, Bases notifications, upcoming view, and release notes.
- **Test data infrastructure**: Generator script fixed and expanded (50 tasks, 45 documents, 18 demo .base views). Separate [tasknotes-test-fixtures](https://github.com/cybersader/tasknotes-test-fixtures) plugin for BRAT installation.

## [4.3.46] - 2026-02-20

### Changed
- **Merged upstream v4.4.0** — Incorporates 141 upstream commits (4.3.1 through 4.4.0) including:
  - MCP server for AI agent integration (4.3.3)
  - Standalone CLI `mdbase-tasknotes` (4.3.3)
  - Extracted NLP package `tasknotes-nlp-core` (4.3.3)
  - Create external calendar events from calendar view (4.3.3)
  - mdbase-spec type generation with `tn_role` annotations (4.4.0)
  - Checklist progress task-card property (4.4.0)
  - Sticky kanban column headers (4.3.1)
  - CSS color classes for context tags (4.3.1)
  - Reset checkboxes on recurrence setting (4.4.0)
  - 40+ bug fixes across modals, time tracking, webhooks, kanban, and calendar views
- All fork features preserved: notifications, bulk tasking, convert-to-task, shared vault identity, property mapping

## [4.3.45] - 2026-02-20

### Added
- **Creator/Assignee fallback PersonGroupPicker**: Creator and Assignee fields now always render with PersonGroupPicker in Create/Edit task modals, even when user fields aren't explicitly configured. Uses per-field-key Map storage to prevent race conditions between multiple pickers.
- **Mapped property "Click to set..." in bulk modal**: Generate/Convert property rows mapped to core fields now use rich editors instead of plain inputs — date-mapped properties open DateContextMenu (calendar popup), assignee-mapped properties scroll to and highlight the ASSIGNEES section.
- **Bidirectional value sync**: Setting a date via the action bar icon syncs to the mapped property row, and vice versa. Both directions stay in sync.
- **Centralized field editor config**: New `OVERRIDABLE_FIELD_EDITORS` and `OVERRIDABLE_FIELD_PICKER_TITLES` in `fieldOverrideUtils.ts` — adding new "Map to" fields requires only config entries, no scattered if-checks.
- **Upstream discussion draft**: Added design discussion points for task modal layout (listed sections vs icon-only actions) and bulk modal assignees consolidation.

### Changed
- **Base View Defaults**: Mapped properties now show read-only "set via task field" label instead of editable value inputs, since default values are future work.
- **Helptip messaging**: Properties & Anchors helptips in Create Task, Edit Task, and Bulk modals now mention the "Map to" feature for mapping custom properties to standard task fields.

### Fixed
- **Creator/Assignee picker race condition**: Fixed shared `assigneePicker` reference causing async group discovery to destroy the wrong picker when both Creator and Assignee are rendered. Now uses per-field-key Map with `data-field-key` targeted DOM lookup.
- **Creator section separator styling**: Fixed triple/double line separators between Assignee and Creator sections — now shows clean single-line separation.

## [4.3.44] - 2026-02-19

### Added
- **Settings migration on change**: Changing any logic-controlling setting (person/group type values, task tag, task property name/value, identity type property name, creator/assignee field names) now shows a confirmation modal: "X notes affected. Migrate all / Change without migrating / Cancel". Prevents silently disconnecting existing notes when renaming frontmatter properties or values.
- **"Migrate frontmatter properties" command**: New command palette action (`Ctrl+P → Migrate frontmatter properties`) for on-demand property key renames, value changes, and tag renames across your vault. Shows live count of affected files, supports folder scoping with autocomplete.

### Fixed
- **View defaults propagation**: Saving defaults in "Base view defaults & settings" tab now immediately reflects in Generate/Convert tabs without requiring modal close/reopen.
- **Card header immediate update**: Changing property names (type, creator, assignee, note UUID, custom fields) now instantly updates the card header subtitle instead of requiring settings reopen.
- **Migration fires on blur, not per keystroke**: Person/group type values and other migration-wired text inputs now trigger the migration confirmation only when you click outside the field, not on every character typed.
- **"Open upcoming view" command name**: Fixed raw i18n key showing as `commands.openUpcomingView` in the command palette instead of the friendly name.

## [4.3.43] - 2026-02-19

### Added
- **PropertyPicker scope chips**: Replaced the single "Vault-wide" checkbox with context-aware scope chips: "This note", "View items", "All tasks", "All files". Chips appear based on available context — opening from a note defaults to "This note", from a Bases view defaults to "View items". Click any chip to switch discovery scope.
- **Context-aware task creation**: `Ctrl+P → Create new task` now auto-detects whether you're focused on a Bases view (passes view items) or a regular note (passes note path) for PropertyPicker discovery.
- **Folder right-click bulk tasking**: Right-click any folder in the file explorer to open "Bulk tasking (X files in folder)" — recursively collects all markdown files under the folder.
- **"Click to set..." pattern in Task Edit modal**: Mapped properties (date fields, assignee fields) in the Edit Task modal now show interactive "Click to set..." placeholders. Clicking opens the date picker or scrolls to the assignee picker, matching the New Task modal behavior.

### Changed
- **File explorer "Bulk tasking" label**: Renamed from "Bulk convert to tasks (X files)" to "Bulk tasking (X files)" — the default tab is controlled by the `defaultBulkMode` setting.
- **"Base view defaults & settings" tab hidden without context**: The view settings tab in BulkTaskCreationModal is now hidden when opened from the file explorer (no base file context), since it has no meaning outside a Bases view.

### Fixed
- **PropertyPicker empty fallback**: When no context is available, PropertyPicker defaults to "All tasks" scope instead of showing empty results.

## [4.3.42] - 2026-02-19

### Changed
- **Configure view panel simplified**: Removed "Notify when" dropdown and threshold slider from the compact popup to avoid Obsidian layout clipping issues. The panel now shows three clean rows: show toolbar toggle, notify toggle, and a "View defaults & settings" link.
- **"View defaults & settings" link**: Renamed from "Default properties & anchors" with a descriptive hint ("Notifications, property mappings, defaults") to clearly communicate what's accessible in the full settings modal.
- **Tab renamed**: "Base view settings" tab in BulkTaskCreationModal renamed to "Base view defaults & settings" for clarity.

### Fixed
- **Configure view panel overflow**: Resolved popup clipping and grey-screen issues caused by injected controls exceeding Obsidian's fixed-height popup container. Detailed notification config now lives exclusively in the full modal.
- **View mappings pre-populate Generate/Convert PropertyPicker**: Field mappings configured in view settings now appear as active property rows with "Use as" badges when opening Generate or Convert tabs.
- **View default properties pre-loaded**: Default property values from the .base YAML are loaded into Generate/Convert custom properties on modal open.

## [4.3.41] - 2026-02-19

### Fixed
- **View mappings now pre-populate Generate/Convert PropertyPicker**: Field mappings configured in "Base view settings" (e.g., `deadline` → Due date) now appear as active property rows with "Use as" badges when opening the Generate or Convert tabs. Previously, mappings were only passed to engines at execution time but not shown in the UI.
- **View default properties pre-loaded into bulk workflows**: Default property values configured per-view in the .base YAML are now loaded into the Generate/Convert custom properties section, so users can see and adjust them before execution.

## [4.3.40] - 2026-02-18

### Added
- **Consolidated Configure view panel**: All view types (native Table/Board/Cards and TaskNotes Task List/Kanban/Calendar/etc.) now show an identical branded TaskNotes section in the Configure view panel with show toolbar toggle, notification toggle, "Notify when" dropdown, threshold slider, and "Default properties & anchors" link.
- **"Notify when" dropdown for native views**: Native Bases views now have the full notification control set (any results match, new items appear, count exceeds threshold) that was previously only available on TaskNotes-registered views.

### Fixed
- **"Open Configure view panel" link**: Clicking the link in BulkTaskCreationModal now reliably closes the modal, opens the popup, and navigates directly to the Configure view sub-panel using polling-based waits and chevron click detection.
- **"Show toolbar buttons" toggle**: Now provides immediate DOM feedback (buttons appear/disappear instantly) and correctly handles toolbars that were already injected.
- **"Global setting" link**: Now navigates to the plugin's Features settings tab and scrolls to the "Bases views" heading.
- **Duplicate TaskNotes sections**: Fixed race condition where switching view types in the Layout dropdown could produce duplicate branded sections in the Configure panel.

## [4.3.39] - 2026-02-18

### Fixed
- **PersonGroupPicker dropdown stays open on collapse**: The assignee search dropdown (appended to `document.body`) now closes when the task creation modal collapses via the chevron button.
- **Assignee icon shows "has-value" dot**: Selecting a person or group in the PersonGroupPicker now immediately updates the assignee action bar icon with the purple indicator dot.

## [4.3.38] - 2026-02-18

### Added
- **Per-base property mapping (ADR-011)**: Bases with custom column names (e.g., `deadline` instead of `due`, `owner` instead of `assignee`) can now configure `tnFieldMapping` in their YAML. Tasks created from these views automatically use the correct property names and get per-task tracking props (`tnDueDateProp`, `tnAssigneeProp`, etc.) so the system recognizes them.
- **Base identity system**: `BaseIdentityService` lazily generates `tnBaseId` and `tnViewId` UUIDs on `.base` files when TaskNotes features are configured. Enables provenance tracking and future migration tools.
- **"New task" button for native Table/Board views**: `BasesToolbarInjector` now injects a "New task" button alongside "Bulk tasking" on native Obsidian Bases views. Opens TaskCreationModal with the view's field mapping pre-populated.
- **PropertyPicker pre-population from view mapping**: When creating a task from a mapped view, Additional Properties shows the mapped fields (e.g., `deadline` with "Use as: Due date" badge) ready to fill in.
- **Click-to-edit for mapped date properties**: Mapped date fields show a read-only display that opens the full DateContextMenu (Today/Tomorrow/Pick date & time) on click, with two-way sync to the action bar calendar icons.
- **Assignee action bar icon**: New `user` icon in the task creation action bar. Clicking it (or clicking a mapped assignee property) expands the details section and scrolls to the PersonGroupPicker with search.
- **Tracking prop schema declarations**: Explicit field mappings via PropertyPicker always write tracking props (e.g., `tnDueDateProp: deadline`) even without values, declaring the task's property schema.

### Fixed
- **Tracking props no longer written without values** in the backend path (`TaskService.applyViewFieldMapping`, `BulkConvertEngine`). Only written when the task has an actual value for the mapped field.
- **Dual value conflict resolved**: When a standard field (Due Date picker) and a mapped property (`deadline`) both have values, the standard field redirects to the mapped property at save time instead of creating duplicates.

## [4.3.37] - 2026-02-17

### Fixed
- **Bulk tasking button shows correct item count**: The "Bulk tasking" modal now shows only the items visible in the current view, matching the view's filter count. Previously it pulled all raw query results (e.g., 137 items when only 10 were visible).
- **Native Table/Board views**: Fixed the toolbar injector to read filtered results from `view.controller.results` directly, instead of falling back to parsing the `.base` file which returned unfiltered results.
- **TaskNotes custom views**: TaskListView, KanbanView, CalendarView, and UpcomingView now cache filtered items after `applySearchFilter()` so the bulk modal receives the same filtered set the user sees.
- **UpcomingView crash on view switch**: Fixed "Cannot read properties of undefined (reading 'data')" error that flashed briefly when switching view types, caused by `extractDataItems()` being called before data was available.

## [4.3.36] - 2026-02-17

### Added
- **Availability window model**: Person notes now support `availableFrom` and `availableUntil` fields (replacing the single `reminderTime`). Day-or-longer reminders pin to the "available from" time. Sub-day reminders outside the window are deferred to the next available start time.
- **Night shift support**: Availability windows that wrap around midnight (e.g., 22:00-06:00) are handled correctly. Reminders outside the overnight window defer to the next shift start.
- **Override vs additive reminder mode**: New `overrideGlobalReminders` toggle on person notes. When enabled (default), personal lead-time reminders replace global rules. When disabled, both fire together with automatic deduplication of matching offsets.
- **Cross-reference links**: "Task Properties > Reminders" links to "Team & Attribution > Person preferences" and vice versa, making it easy to navigate between global and per-person reminder settings.

### Changed
- **"Personal global reminders" section**: Renamed from "Lead times" in the Team & Attribution settings for clarity.
- **"Add personal reminder" button**: Renamed from "Add lead time" to match the new section name.
- **Lead time display format**: Items now show "X before anchor" (e.g., "2 hours before anchor") instead of bare values.
- **Backwards-compatible migration**: Setting "Available from" automatically removes the legacy `reminderTime` field from person note frontmatter. Notes with only `reminderTime` still work via automatic fallback.

## [4.3.35] - 2026-02-13

### Added
- **Edit existing reminders**: Pencil icon on each reminder card in the ReminderModal. Clicking it scrolls to the form, pre-populates all fields (type, offset, unit, direction, anchor, date/time, description), and switches to "Update Reminder" mode. Custom property anchors appear correctly selected in the "Relative to" dropdown. Editing card gets a visual highlight border. "Cancel edit" link returns to add mode.
- **Clickable timeline markers**: Timeline markers in the ReminderModal are now clickable — clicking a marker scrolls to and flash-highlights its corresponding reminder card (matching the settings timeline behavior).
- **Help icons across all modals**: Help-circle icons with descriptive tooltips on section headers in TaskEditModal (Properties & anchors, Completions, Task info), ReminderModal (Current Reminders, Add New Reminder), and the Properties & anchors settings section (Core, Global custom properties, Discovered & available group headers).
- **Task Properties overview callout**: New introductory callout at the top of Settings > Task Properties explaining the layered property system — global defaults here, per-task overrides via "Properties & anchors" in the Edit Task/Bulk Task modals, and reminder anchors in the Reminder modal.
- **Settings PropertyPicker non-date hint**: The property search in the settings Properties & anchors section now shows the same flash + inline hint behavior as the Reminder modal when clicking a non-date property, guiding users to convert first.
- **Auto-promote after conversion in settings**: After converting a non-date property to date via the "→ date" button in the settings PropertyPicker, the property is automatically promoted to a global custom property.

### Fixed
- **PropertyPicker dropdown not closing**: Removed broken `modal-container` count guard that always blocked close in stacked modal workflows (task edit + reminder modal = 2+ containers). Replaced `focus` listener with click toggle + 300ms debounce to prevent race conditions with Obsidian's focus management.
- **Type dropdown flash-close**: Native `<select>` option lists render outside the DOM tree, causing click-outside handlers to treat them as "outside". Added `HTMLSelectElement` active element guard in the PropertyPicker's outside-click handler.
- **Vault-wide checkbox persistence**: PropertyPicker "All tasks" checkbox state now persists across re-renders within the same ReminderModal session.
- **Non-date property click closing dropdown**: Clicking a non-date property in the PropertyPicker search triggered a blur event that closed the entire dropdown after 200ms. Added `dropdownClickedRecently` mousedown flag to prevent blur-close during dropdown interaction.
- **Raw property keys in "Relative to" dropdown**: Custom property anchors now show their raw frontmatter key (e.g., `follow_up`) instead of prettified display names (e.g., "Follow up") so users can identify the actual property name.

### Changed
- **PropertyPicker non-date hint**: Clicking a non-date property shows an inline hint with 4-second fade-out instead of a Notice, guiding users to use the conversion button. Applies to both modal and settings instances.
- **Auto-scroll after anchor selection**: Selecting a date property as anchor auto-scrolls to the "Relative to" dropdown in the Reminder modal.

## [4.3.34] - 2026-02-11

### Added
- **Reminder timeline preview**: Live-updating horizontal timeline in Settings > Task Properties > Reminders showing all configured reminders relative to the anchor date
  - Default reminders shown above the line (blue), global reminders below (orange)
  - Human-readable offset labels ("1 day before", "3 hours after") instead of raw descriptions
  - Time scale ticks with adaptive intervals ("1 day", "1 week", "1 month", "1 year")
  - **Time jump breaks**: When reminders span vastly different scales (e.g., 1 day + 6 months), the timeline inserts a `⋯` break instead of squishing markers together
  - **Click-to-scroll**: Click any timeline marker to scroll to and highlight its configuration card
  - **Label collision avoidance**: Overlapping labels automatically nudge apart
- **Global reminder rules**: Virtual reminders evaluated at runtime for all tasks with matching dates (lead-time, due-date persistent, overdue repeating, start-date)
  - Configurable in Settings > Task Properties > Reminders > Global Reminders
  - `skipIfExplicitExists` option to defer to task-specific reminders
  - Three preset rules (all disabled by default): 1-day lead time, persistent due-date, daily overdue
- **Semantic type presets** in ReminderModal: Quick-add buttons for common reminder patterns
- **Visual separation**: Default and Global reminder sections have distinct accent borders (blue/orange) for clear hierarchy
- **Help text and cross-links**: Descriptions, semantic type explanations, and navigation links between Features and Task Properties tabs

### Changed
- **Reminder "Relative to" dropdown**: Now groups anchors by origin (core fields, custom mapped, discovered) with section headers
- **ReminderModal clarity**: Improved field labels and descriptions for offset, direction, and anchor selection

## [4.3.33] - 2026-02-11

### Added
- **Universal Bases view support**: "Bulk tasking" button now appears on ALL Obsidian Bases views (Table, Board, etc.), not just TaskNotes-registered view types
  - New `BasesToolbarInjector` service detects any `.bases-toolbar` and injects the button
  - Native "New" button preserved on non-TaskNotes views (creates normal files as expected)
  - Automatic cleanup when switching between TaskNotes and non-TaskNotes view types
  - New setting: "Universal view buttons" in Features > Bases views section
- **CHANGELOG backfill**: Added real release notes for versions 4.3.24-4.3.32 (previously only had stubs)
- **CHANGELOG enforcement**: PostToolUse hook warns if CHANGELOG.md is missing an entry for the current version during commits/pushes
- **View Settings UX**: Added to roadmap as future enhancement

### Changed
- **PropertyPicker "mismatch" badge**: Renamed to "mixed type" with hover tooltip explaining which files have inconsistent property types and how to fix them
- **Edit Task modal PropertyPicker**: Search now appears above the property fields list (matching the bulk modal layout)

### Fixed
- **Toolbar buttons disappearing after view switch**: Buttons no longer vanish when switching Table → Task List → back to Table within the same .base file. Root cause: stale WeakSet caching prevented re-injection after Bases reused toolbar DOM elements.

## [4.3.32] - 2026-02-11

### Added
- **Per-task field overrides**: Custom frontmatter properties (e.g., `deadline`, `review_date`) can now replace core date fields (due, scheduled, completedDate, dateCreated) on a per-task basis
  - Tracking properties (`tnDueDateProp`, `tnScheduledDateProp`, etc.) written to task frontmatter
  - FieldMapper resolves overrides before falling back to global settings mapping
  - New utility: `fieldOverrideUtils.ts` for constants, read/write helpers
- **Expandable mapping rows**: Date-type custom properties in Edit Task and Bulk modals show expandable "Maps to" dropdown
  - Inline badge (e.g., "Due") visible at a glance when mapping is set
  - Conflict detection when both custom and default property exist

### Fixed
- **Bulk modal custom properties persistence**: Property rows no longer disappear when adding new properties. Root cause: active list was inside PropertyPicker's container (which calls `container.empty()` on refresh). Fixed by making active list a sibling in the parent section.

## [4.3.31] - 2026-02-11

### Changed
- **Safe hide button**: "x" remove button on custom properties changed to eye-off "Hide" button that only hides the property from the modal view, does NOT delete from frontmatter
- **Consistent naming**: Renamed "Additional properties" to "Custom properties" across Edit Task modal to match bulk modal terminology

## [4.3.30] - 2026-02-10

### Fixed
- **Custom properties in Reminder "Relative to" dropdown**: Pass task path and userFields as customProperties to ReminderContextMenu so `getAvailableDateAnchors()` can discover custom date properties
- Added `getTaskPath()` override pattern for TaskEditModal

## [4.3.29] - 2026-02-10

### Fixed
- **Search input padding override**: Added inline style + `!important` to ensure PropertyPicker search input padding-left isn't overridden by Obsidian's built-in input styles (CSS specificity issue)

## [4.3.28] - 2026-02-10

### Added
- **Reminder origin indicators**: "Relative to" dropdown groups anchors by origin (Core / User fields / Discovered)
  - `DateAnchor` interface gains `origin` field for tracking property source
- **Scroll affordance gradient**: Bottom fade gradient on bulk modal body

### Changed
- CUSTOM PROPERTIES separated into its own section with proper spacing from BULK VALUES
- Search input padding refined (34px + box-sizing)
- Custom Properties help text expanded with examples

## [4.3.27] - 2026-02-10

### Fixed
- **isTask in Additional Properties**: Excluded `isTask`/`identityType` properties from Additional Properties (buildSkipKeys now includes taskPropertyName + identityTypePropertyName)
- **Search input overlap**: Increased padding and vertically centered magnifying glass icon in PropertyPicker

### Changed
- Replaced confusing braces icon with CUSTOM PROPERTIES section heading + help tooltip in bulk modal
- Renamed "All tasks" to "Vault-wide" with tooltip explaining scope

## [4.3.26] - 2026-02-10

### Fixed
- **Duplicate date anchors**: Skip FieldMapper-mapped frontmatter names in date anchor discovery (prevents duplicate "Due date" when internal "due" maps to "due_date")
- **Bulk modal braces icon**: Added missing icon to `renderActionBarInto()` (appeared after mode switch)
- **Additional Properties styling**: Added separator + uppercase label for cleaner section appearance

### Added
- `buildSkipKeys()` shared helper for consistent property exclusion across modules

## [4.3.25] - 2026-02-10

### Added
- **PropertyPicker auto-discovery**: Custom frontmatter properties in Edit Task, Task Creation, and Bulk modals without manual settings registration
  - Searchable PropertyPicker UI with type-ahead filtering
  - Type detection (text, number, date, boolean, list) from existing frontmatter values
  - Vault-wide scanning for property discovery across task files
  - Type conversion when adding properties to tasks
  - New utility: `propertyDiscoveryUtils.ts` for centralized property scanning
  - New component: `PropertyPicker.ts` with CSS in `styles/property-picker.css`

## [4.3.24] - 2026-02-09

### Fixed
- Reminder anchor dropdown now uses auto-discovered date properties correctly
- Context menu event registration in TaskListView
- Normalize YAML Date objects in dateAnchorUtils (Obsidian's YAML parser converts bare dates to JS Date objects)

### Changed
- Removed dead `taskTypeValue` from settings type (was unused code)
- Default `identityTypePropertyName` changed to `tnType` (avoids conflicts with other plugins)

### Added
- WSL2 auto-detection for Playwright E2E launcher
- Development/Testing/E2E sections added to README
- Settings cross-link navigation in task properties and shared vault tabs

## [4.3.23] - 2026-02-09

### Added
- **Dynamic reminder anchors**: Reminders can now be relative to ANY date property, not just due/scheduled
  - Built-in anchors: due, scheduled, dateCreated, dateModified, completedDate
  - Custom date fields from user-configured properties are automatically discovered
  - Edit Task modal reminder dropdown shows all available date anchors with current values
  - Right-click context menu quick reminders dynamically list all anchors with values
  - Settings > Default Reminders dropdown enumerates all date properties
  - Bulk task creation applies reminders with any anchor type
  - New utility: `dateAnchorUtils.ts` for centralized anchor discovery and resolution

### Changed
- `Reminder.relatedTo` type widened from `"due" | "scheduled"` to `string` for extensibility
- NotificationService uses dynamic anchor resolution instead of hardcoded due/scheduled check
- ReminderModal uses dynamic dropdown instead of hardcoded two-option select
- ReminderContextMenu dynamically iterates all date anchors instead of two hardcoded sections
- TaskContextMenu quick reminders use dynamic anchor discovery
- Settings remindersPropertyCard uses dynamic anchor list

## [4.3.22] - 2026-02-09

### Changed
- **Bulk modal UI overhaul**: Complete redesign matching Edit Task modal polish
  - Icon-based action bar for bulk values (due, scheduled, status, priority, reminders)
  - Underline-style mode tabs (Generate / Convert) replacing segmented control
  - PersonGroupPicker integration for assignee selection with search and multi-select
  - Expandable items section with skip badges and item counts
  - Inline compatibility badges in Convert mode (ready/skipped counts)
  - Fixed-height modal (80vh) to prevent layout shift when switching tabs
  - Stackable reminders via ReminderModal (multiple reminders per bulk operation)
  - Unified bulk values across both Generate and Convert modes
  - Inline warning when reminders set without due/scheduled date
  - New BEM-scoped CSS (`styles/bulk-modal.css`)

## [4.3.21] - 2026-02-07

### Fixed
- **Settings navigation bug**: "Open Team and Attribution settings" button now works correctly
  - Fixed ID mismatch in taskPropertiesTab.ts and sharedVaultTab.ts
  - Tab bar no longer disappears when clicking cross-tab navigation links

### Added
- **Configurable type properties**: Enterprise compatibility for person/group/task note detection
  - New settings in Team & Attribution → Type property configuration
  - `identityTypePropertyName`: Change property name used for type detection (default: "type")
  - `personTypeValue`: Value that identifies person notes (default: "person")
  - `groupTypeValue`: Value that identifies group notes (default: "group")
  - `taskTypeValue`: Value that identifies task notes for Bases (default: "task")
  - Allows using custom properties if "type: person" conflicts with other plugins

## [4.3.20] - 2026-02-06

### Added
- **NotificationCache**: High-performance caching layer for notification items
  - 45-second TTL on aggregated results
  - In-flight promise deduplication (prevents concurrent duplicate evaluations)
  - Folder→Bases inverted index for O(1) invalidation lookup
  - Bell click is now instant (~1ms cache hit vs ~200-500ms full scan)
- **Per-category reminder behavior settings**: Each time category has configurable behavior
  - Overdue, today, tomorrow, thisWeek, scheduled, queryBased categories
  - Dismiss behaviors: until-restart, snooze-1h/4h/1d, until-data-change, until-complete, permanent
  - Per-category bell toggle (show/hide in status bar count)
  - Per-category toast toggle (show/hide popup notification)
  - Advanced settings section in Settings → Notifications → General
- **Scrollable toast items**: Click "+X more" to enable scroll mode with all items visible
- **Ctrl+hover page preview**: Task titles in toast support Ctrl+hover to show page preview

### Changed
- **Bell shows PENDING only**: Status bar count now shows only unseen items where category has `showInBellCount: true`
- **Smart invalidation**: File changes only re-evaluate bases that monitor the changed folder (not ALL bases)
- **Console log timestamps**: All debug console output now includes ISO timestamps for traceability
- **Settings reorganized**: Notifications section split into General/Task/Base sub-sections
  - Global settings (toast click, status bar click, check interval, show on startup) moved to General
  - Per-category behavior settings in General → "Reminder behavior by category (advanced)"
- **Settings UX clarity**: Improved labels and help text for reminder behavior settings
  - "Bell" → "Show in bell count", "Toast" → "Show popup", "Dismiss:" → "After 'Got it':"
  - Dynamic help text explains what happens when you dismiss (e.g., "Removed from bell for **4 hours**, then returns")
  - Dynamic values highlighted in accent color for visual distinction from template text
  - Category cards with background and accent border for clearer visual grouping
  - Footer explanation updated with clearer bullet-point format

### Fixed
- **Toast click area**: Click handler now includes subtitle text for expand mode (was only handling explicit elements)
- **Constant background activity**: Removed O(n) "evaluate ALL bases" approach on every file change
- **Delayed bell response**: Bell click now returns cached data instantly instead of waiting for full evaluation

### Performance
- Bell click: ~200-500ms → ~1ms (cache hit)
- Periodic check (no changes): Full scan → Instant (cache hit)
- File change in monitored folder: ALL bases evaluated → Only affected bases
- File change elsewhere: ALL bases evaluated → No evaluation

## [4.3.19] - 2026-02-03

### Added
- **Per-device notification preferences**: Each device can override vault-wide notification settings
  - Notification type (in-app, system, both) per device
  - Scope filtering (by assignment) per device
  - Uses localStorage — never syncs across devices
- **"Both" notification delivery**: New option sends both in-app toast and system notification
- **Toast snooze dropdown**: Snooze all notifications with 4 duration options (15m, 1h, 4h, until tomorrow)
- **Toast overdue highlighting**: Overdue count shown in red in toast subtitle
- **Test notification button**: Send test in-app/system/both notifications from settings
- **Notification troubleshooting**: Collapsible guide for system notification issues (Windows Electron limitation)
- **Settings cross-links**: Navigate between Features and Team & Attribution notification sections

### Changed
- **Actionable toasts persist**: Toasts with action buttons no longer auto-dismiss (WCAG 2.2.4 compliance)
- **Toast dismiss button**: Now shows text "Dismiss" instead of icon (better visibility in dark themes)
- **Realistic test notification**: Shows aggregated toast with snooze instead of simple message
- **Shared assignee filter**: NotificationService and VaultWideNotificationService use common filtering logic

### Fixed
- **NotificationService device prefs**: Now reads notification type from per-device preferences instead of vault-wide only
- **"Both" permission request**: System notification permission requested for "both" delivery type

## [4.3.18] - 2026-02-03

### Added
- **UpcomingView 2-row Todoist layout**: Items now display in two rows
  - Row 1: Checkbox + title + assignee avatar stack
  - Row 2: Date/time (color-coded) + project/context or base indicator
  - Base notifications show layers icon + count on Row 2 (number before icon for alignment)
- **"Edit task" context menu**: Right-click any task or base notification to open the edit modal
- **"Assign" context menu**: Right-click to assign/unassign persons and groups
  - Toggle behavior: adds if not assigned, removes if already assigned (multi-select)
  - Supports multiple assignees simultaneously
- **PersonGroupPicker in Edit Task modal**: Assignee and creator fields render with full picker UI
  - Search, pills for selected items, grouped dropdown (People/Groups)
  - Pre-loads existing assignees when editing tasks

### Changed
- **Shortest wikilinks**: Assignee fields now store shortest unique path (e.g., `[[Cybersader]]` instead of `[[User-DB/People/Cybersader]]`)
- **UpcomingView item spacing**: Increased vertical padding (12px) and row gap (3px) to match Todoist density
- **Base notification avatars**: Now visible alongside the layers icon (previously hidden by if/else)

### Fixed
- **PersonGroupPicker detection**: Case-insensitive key comparison fixes field matching edge cases
- **Ctrl+click in UpcomingView**: Now opens tasks and base notifications in new tabs
- **Creator field rendering**: No longer shows as empty text box; uses PersonGroupPicker like assignee
- **Ghost user fields**: Empty-key fields in settings are skipped instead of rendering blank inputs
- **Edit Task modal spacing**: Added margin between field groups (title/contexts gap)
- **Assignee picker loading**: Resolves shortest wikilinks correctly when loading existing assignees

## [4.3.17] - 2026-02-02

### Added
- **Person avatars**: Circular avatars with initials for person/group display
  - Consistent color generation from name hash (15-color palette)
  - Size variants: xs (20px), sm (24px), md (32px), lg (40px)
  - Group indicator (folder icon in corner) for group notes
  - Avatar stacks for showing multiple assignees with overflow indicator (+N)
  - Integrated into person note selector in Settings → Team & Attribution
  - "Registered as" section shows clickable avatar that opens person note
  - **Edit button** to customize display name and avatar color without editing file
  - **Error handling** for deleted/moved person notes with visual warning
  - Custom avatar color stored in settings (persists even if file is deleted)
- **Periodic toast notification check**: Status bar and toast updates on configurable interval
  - Uses `checkInterval` setting from vault-wide notifications
  - Triggers toast for urgent items (overdue, today)
- **Bulk assignee selection**: Assign tasks in bulk from Bases view
  - Dropdown in BulkTaskCreationModal with discovered persons and groups
  - Shows avatar preview next to dropdown
  - Groups shown with folder icon indicator
  - `discoverPersons()` method added to PersonNoteService
- **Assignee-aware notification filtering**: Only notify for tasks assigned to you
  - New setting: "Only notify for my tasks" (default: off for backwards compatibility)
  - "Include unassigned tasks" option when filtering is enabled
  - Resolves group membership (nested groups supported)
  - Visual identity status in settings with registration guidance

### Changed
- File selector modal now supports avatar display via `showAvatars` option
- Person note selector in Team & Attribution settings shows avatars

## [4.3.16] - 2026-02-02

### Added
- **Zettel date fallback chain**: Configure which date to use for zettel YYMMDD portion
  - New setting `zettelDateChain` with ordered fallback: Due → Scheduled → Creation
  - Visual chain selector UI with clickable `[Due] → [Scheduled] → [Creation]` buttons
  - Live preview showing 3 scenarios with example zettel IDs and human-readable dates
  - Automatic migration from legacy `zettelDateSource` setting
- **Comprehensive filename preview**: Title property card now shows live preview at top
  - Frontmatter preview with user-configured property names
  - `← zettel date` indicator shows which property is used based on fallback chain
  - Normal filename + collision filename with highlighted suffix
  - Collision behavior description
  - Contextual tip for collision-proof naming
- **Custom template variables expansion**: Preview now supports all variables
  - `{{title}}`, `{{zettel}}`, `{{timestamp}}`
  - `{{dueDate}}` / `{{due}}`, `{{scheduledDate}}` / `{{scheduled}}`, `{{createdDate}}` / `{{created}}`
  - `{{random}}`, `{{randomLong}}`, `{{milliseconds}}` / `{{millisecondsPadded}}`
  - Preview updates on blur for instant feedback
- **Template variables documentation**: Expandable section in settings with full variable reference
  - Table showing all variables with descriptions and examples
  - Aliases note for shorthand syntax
  - Link to comprehensive docs page (`docs/filename-templates.md`)
- **Settings connection UX**: Visual indicators linking related settings
  - "Retry suffix format" shows "Uses date fallback chain below ↓" when zettel selected
  - Chain description shows "Also used by retry suffix above ↑" when relevant
  - Changing either setting updates both indicators
- **Context-aware "rich" date format** for Upcoming View
  - Smart year display: Skips year if same as current year
  - Today/Tomorrow labels: "Feb 3 • Today • Monday"
  - Clean format: "Feb 5 • Wednesday"

### Fixed
- **Configure view toggle not working**: Bases API returns toggle values as strings ("true"/"false"), not booleans. Fixed type checking in `getDateSettings()` to handle both
- **Section header duplication**: "Feb 2 • Today • Monday • Today • Monday" bug fixed by using simple date format in section headers
- **Zettel collision uniqueness**: Changed from seconds to milliseconds for sub-second collision prevention
- **FilenameCollisionModal missing context**: Now receives due date, scheduled date, and zettel settings for accurate preview
- **"Edit task" action in collision modal**: Returns to task creation screen instead of cancelling

## [4.3.15] - 2026-02-02

### Added
- **New "zettel-title" filename format**: Combines sortable date ID with readable title
  - Format: `260202abc-My Task Title.md` (zettel ID + dash + title)
  - Short, sortable, readable, and collision-proof
  - Available in Settings → Task Properties → Title → Filename format
- **Filename collision behavior setting**: Control how duplicate filenames are handled
  - "Auto-resolve silently" - append -2, -3, etc. without notification (default)
  - "Auto-resolve and notify" - append suffix and show a notice
  - "Always ask me" - show recovery modal to choose action
  - Located in Settings → Task Properties → Title → Filename settings
- **Retry suffix format setting**: Configure what suffix to append when retrying
  - Timestamp (m5abc123) - base36 timestamp (default)
  - Random (k3f) - 3-character random suffix
  - Zettel ID (260202abc) - full zettel identifier
- **Filename collision recovery modal**: User-friendly recovery when file creation fails
  - TaskNotes branding in modal header
  - Clear sections: "Change format for all future tasks" vs "One-time fix"
  - All 5 format options available: zettel-title (recommended), zettel, timestamp, title, custom
  - Preview of exact filename when using "Retry once"
  - Quick access to settings
- **New custom template variables**: For collision-proof filenames
  - `{{millisecondsPadded}}`: Zero-padded milliseconds (000-999) for proper sorting
  - `{{random}}`: 2-character base36 suffix (00-zz)
  - `{{randomLong}}`: 3-character base36 suffix (000-zzz)
  - Recommended collision-proof template: `{{year}}{{month}}{{day}}{{hour}}{{minute}}{{second}}{{millisecondsPadded}}{{random}}`
- **Note UUID system**: Persistent unique identifiers for notes that survive renames/moves
  - `NoteUuidService` generates and manages UUIDs in frontmatter (`tnId` by default)
  - Configurable property name in Settings → Task Properties → Metadata Properties
  - Auto-generates on task creation (TaskService, BulkTaskEngine, BulkConvertEngine)
  - Foundation for future state tracking (snooze, view-entry timestamps, duplicate detection)
- **Groups system**: Group notes (`type: group`) with nested group resolution
  - `GroupRegistry` discovers groups and resolves members recursively
  - Cycle detection prevents infinite loops (max depth: 10)
  - Settings UI section for group notes folder and tag filter
- **Person preferences**: `PersonNoteService` reads reminder preferences from person note frontmatter
  - Configurable `reminderTime`, `reminderLeadTimes`, `notificationEnabled`
- **Bulk operation types**: Unified `BulkOperationResult` interface for consistent result handling
  - Helper functions: `createEmptyResult`, `mergeResults`, `formatResultNotice`
  - Conversion functions: `fromCreationResult`, `fromConvertResult`
- **Device identity integration**: Creator field auto-populated in bulk task creation and conversion

### Fixed
- **Case-insensitive filename collision on Windows**: `generateUniqueFilename()` now uses case-insensitive comparison to prevent "File already exists" errors when filenames differ only by case (e.g., "Test" vs "test")
- **Folder autocomplete drill-down**: Selecting a folder with subfolders now keeps the dropdown open to show subfolders, instead of requiring manual re-entry

## [4.3.14] - 2026-02-01

### Added
- **Upcoming View** (`tasknotesUpcoming`): New Todoist-style Bases view type for aggregated task display
  - Time-categorized sections: Overdue, Today, Tomorrow, This Week, This Month, Later, No Due Date
  - Agenda-style date navigation bar with period selectors (Year, Month, Week, 3-Day, Day, List)
  - Arrow navigation (< >) and "Today" quick-jump button
  - Collapsible sections with item counts
  - "Add task" button at bottom of each section (creates task with correct due date)
  - Reschedule action in section headers
- **Base Notification Sync Service**: Real TaskNote files for notification-enabled bases
  - Creates task files with `type: base-notification` for bases with `notify: true`
  - Fully compatible with Bases filtering (sync-to-files approach)
  - Auto-sync on plugin load, periodic checks, and manual command
  - Configurable behavior when base has no matching items
- **Base notification rendering in Upcoming view**:
  - Bell icon indicator for base notification tasks
  - Right-side accent border for visual distinction
  - Item count badge (e.g., "11" with layers icon)
  - Specialized context menu: Open base, Open task, Mark resolved, Reschedule, Snooze
- **Time display** (Todoist-style): Clock icon with formatted time for tasks with time component
- **Date row color coding**: Overdue (red), Today (green), Tomorrow (orange), This Week/Month (accent), Later (muted)

### Fixed
- **Date categorization timezone bug**: Tasks due "today" were incorrectly showing as "overdue" in negative UTC offset timezones. Root cause: `new Date("YYYY-MM-DD")` parses as UTC midnight. Fixed by using `parseDateAsLocal()` for timezone-safe local date parsing.
- **Add task date bug**: Creating task for "Tomorrow" created it on wrong day due to `toISOString()` UTC conversion. Fixed by using local date components directly.
- **Hover jitter on base notification items**: Conflicting CSS hover styles caused layout shifts. Fixed with consistent padding/margin in hover state.

### Changed
- **Overdue display**: Removed redundant "Due" prefix (e.g., "Yesterday" instead of "Due yesterday") since items are already in red Overdue section
- **Add task button indent**: Subtle 4px indent to align with task content (reduced from 26px)
- **Base notification accent**: Changed from bright purple to subtle `--text-accent` color

## [4.3.13] - 2026-01-30

### Changed
- **Opt-in debug logging**: Converted debug console statements to use DebugLog utility for Obsidian plugin guidelines compliance
  - `BasesQueryWatcher.ts`, `bulk-convert-engine.ts`, `BasesViewBase.ts` now use `plugin.debugLog.*`
  - Debug/log/warn messages only output when debug mode enabled (toggle via command)
  - Error messages still always output (allowed per Obsidian guidelines)
  - Logs written to both console and `debug.log` file when enabled

### Fixed
- **E2E cross-platform support**: Improved Obsidian binary detection for Windows/macOS/Linux in Playwright tests
- **E2E port conflict**: Changed remote debugging port from 9222 to 9333 to avoid Chrome conflicts

## [4.3.12] - 2026-01-30

### Fixed
- **What's New page missing versions**: Build script now auto-generates missing release notes from CHANGELOG.md when versions are skipped (e.g., due to CI failures)

### Added
- Release notes gap detection in `generate-release-notes-import.mjs`

## [4.3.11] - 2026-01-30

### Added
- **Folder autocomplete** for Default Tasks Folder and Archive Folder settings (Task Storage section)

### Fixed
- CI build failure due to missing device identity service imports in main.ts

## [4.3.10] - 2026-01-30

### Added
- **Team Attribution enhancements**:
  - Creator and Assignees cards now include descriptive help text
  - Type dropdown (Text/List) for changing property format
  - Type badge showing current field type in card header
  - Auto-conversion of existing task data when type changes (text↔list)
  - Delete buttons to remove Creator/Assignees fields when not needed
  - Default types documented in overview callout (Creator: text, Assignees: list)

### Fixed
- Duplicate "Add User Field" buttons in Custom User Fields section (empty state + setting)
- Translation key showing literally as label in property settings

### Changed
- Toned down success styling for Team Attribution fields (subtle green border only)
- Assignees field now defaults to "list" type for multiple people
- Clarified notification wording: "everyone using the vault" instead of "the entire team"

## [4.3.9] - 2026-01-29

### Fixed
- **isTask still empty after convert**: Replaced complex conditional logic with simple unconditional approach. Now deletes existing value and sets fresh boolean `true`. No more edge cases.

## [4.3.8] - 2026-01-29

### Fixed
- **isTask empty value bug**: When `isTask:` had no value (YAML null), the convert engine didn't repair it. Now handles `null` in addition to `undefined` and empty string.

## [4.3.7] - 2026-01-29

### Fixed
- **isTask checkbox rendering (dash/prohibition symbol)**: Added auto-repair for files with string `"true"` instead of boolean `true`. Convert mode now detects and fixes type mismatches, ensuring Obsidian Bases renders checkboxes correctly.
- **BasesQueryWatcher "monitoring 0 bases"**: Added debug logging to identify why `.base` files with `notify: true` weren't being monitored. Silent YAML parse errors are now logged.

### Changed
- Convert engine now coerces boolean-like strings (`"yes"`, `"no"`, `"1"`, `"0"`) to proper booleans

## [4.3.6] - 2026-01-28

### Fixed
- **isTask detection bug**: `TaskManager.isTaskFile()` rejected empty `taskPropertyValue` setting, so converted files with `isTask: true` were never recognized as tasks. Guard clause now treats empty value as "property existence check" (any truthy value matches).
- **Task creation with empty propValue**: `TaskService` now defaults to `isTask: true` (boolean) when `taskPropertyValue` setting is empty, matching the convert engine's behavior.

## [4.3.5] - 2026-01-28

### Added
- Compatibility panel in Convert mode showing file type breakdown before conversion
  - Shows ready-to-convert, already-task, and non-markdown file counts
  - Expandable section listing incompatible filenames (max 5, then grouped overflow)
  - Warning banner when >25% of files will be skipped

### Fixed
- "What's New" page now shows fork release notes (was only showing upstream versions)
- Re-converting files with empty `isTask: ""` from buggy v4.3.3 now properly sets `isTask: true`

## [4.3.4] - 2026-01-28

### Fixed
- Convert mode now skips non-markdown files (e.g., `.xlsx`, `.pdf`, `.png`) instead of timing out on metadata cache
- Pre-check shows non-markdown file count in status message

## [4.3.3] - 2026-01-28

### Fixed
- `isTask` property now defaults to `true` when `taskPropertyValue` setting is empty (was setting empty string)

## [4.3.2] - 2026-01-28

### Fixed
- GitHub release workflow now auto-publishes with correct assets (`main.js`, `manifest.json`, `styles.css`)

### Changed
- Bulk Tasking modal UI cleanup: removed redundant description, preview heading, file icons; tightened spacing

## [4.3.1] - 2026-01-28

### Added
- GitHub Actions release workflow for BRAT installation
- Automated releases on version bump

## [4.3.0-fork.1] - 2026-01-28

### Added
- **Bases Query Notifications**: Todoist-style modal triggered by `notify: true` in `.base` files
  - Per-item Open, Complete, Snooze, Dismiss buttons
  - Background watcher evaluates on task updates
- **Bulk Task Generation**: "Bulk tasking" button in Bases toolbar
  - Creates new task files from view results
  - Duplicate detection (wiki-link parsing, URL decode, filename fallback)
  - Skip existing toggle
- **Bulk Convert-to-Task**: Second mode in Bulk Tasking modal
  - Adds task metadata to existing notes in-place
  - Respects `taskIdentificationMethod` setting
  - Optional base-view linking
  - Default mode setting
- **Device-User Identity** (scaffolded): UUID-based device identity for future per-person task targeting
- **Dev tooling**: Test data reset script (`bun run reset`)

### Changed
- Button renamed from "Generate tasks" to "Bulk tasking"
- `.gitignore` updated to include build outputs for BRAT installation

---

## Upstream Releases

For changes in the upstream TaskNotes plugin, see: https://github.com/callumalpass/tasknotes/releases
