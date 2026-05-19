# TaskNotes Data Flow

This document records the intended data-flow model for the refactor.

## Source of Truth

Task data is stored in Markdown files with frontmatter inside the user vault.

Primary source of truth:

- markdown file content
- Obsidian metadata cache for indexed read access

TaskNotes should avoid introducing a competing internal database for core task state.

## Settings Startup Path

1. `TaskNotesPlugin` asks `settingsPersistence` to read plugin `data.json`.
2. If Obsidian returns `null` while the existing data file is present, the read
   is retried before defaults are trusted.
3. A compromised startup read blocks settings saves for that session so
   existing user configuration is not overwritten by in-memory defaults.
4. Legacy settings and nested defaults are normalized in
   `settingsPersistence` before `TaskNotesPlugin.settings` is assigned.
5. Settings-only saves write the known settings keys back to plugin data while
   preserving other persisted plugin state already in `data.json`.

## Read Path

1. Vault files change.
2. Obsidian metadata cache updates.
3. `TaskManager` and related adapters read task state from metadata cache.
4. Task frontmatter is identified through `taskIdentification`, then mapped
   task data is completed through `taskInfoAssembly`.
5. Filter/query behavior receives user-field settings, i18n, link resolution,
   and subtask lookup through the `FilterService` runtime contract rather than
   reaching for the full plugin object.
6. Query predicate evaluation runs through `filterPredicateEvaluation`, which
   owns recursive group semantics, user-field coercion, project-link matching,
   `hasSubtasks`, and `status.isCompleted` decisions.
7. Domain services and views consume normalized `TaskInfo` representations.

## Write Path

1. A view, modal, command, or API endpoint requests a task mutation.
2. The request flows through `TaskService` or a dedicated mutation collaborator.
3. Single-property updates are normalized and planned through
   `taskPropertyUpdate` before frontmatter is written.
4. Bulk task updates are normalized and planned through `taskUpdatePlanning`
   before mapped frontmatter or body writes happen.
5. Frontmatter/body changes are written to the markdown file.
6. `taskPropertyChangeSideEffects` refreshes the task cache, emits task update
   events, and runs webhook, calendar-sync, and auto-archive side effects.
7. Obsidian metadata cache emits update events.
8. Event listeners invalidate caches and refresh views.

Task creation payload assembly should happen before the write boundary:

- `TaskCreationService` and `TaskUpdateService` receive narrow runtime
  contracts, not the full plugin type, so the task write path documents which
  settings, app, cache, event, mapper, and sync capabilities it can use.
- Bases view filters are converted into frontmatter defaults through
  `basesFilterDefaults` before the creation payload is assembled.
- Bases `New` frontmatter is normalized through `basesTaskCreation`.
- Kanban column and swimlane creation defaults are planned through
  `kanbanCreationDefaults` before the creation payload is assembled.
- Modal user fields are normalized through `taskModalUserFields`.
- Modal creation defaults and pre-populated values are normalized through
  `taskCreationFormState` before `TaskCreationModal` renders or saves.
- Modal post-save subtask project writes are planned through
  `taskCreationSubtasks`.
- Modal edit defaults and cached user-field values are normalized through
  `taskEditFormState` before `TaskEditModal` renders.
- Modal edit writes read existing frontmatter and assemble change input through
  `taskEditChangeState` before `TaskEditModal` calls `TaskService`.
- Modal edit subtask additions/removals are planned through `taskEditSubtasks`
  before child task project links are updated.
- NLP/API creation payloads use the shared parsed-data assembly path.
- Convert-current-note command payloads use `currentNoteConversion` to coerce
  existing frontmatter, apply status/priority defaults, and extract the body
  before opening the edit modal.
- Task creation defaults are applied through `taskCreationDefaults`.
- Task title sanitization for filenames and stored frontmatter values is applied
  through `taskTitleSanitizer`.
- Single-property task updates use `taskPropertyUpdate` to normalize incoming
  values and apply frontmatter mutation rules.
- Bulk task updates use `taskUpdatePlanning` to sanitize time-entry updates,
  plan recurrence date/DTSTART changes, apply mapped frontmatter and explicit
  field-removal rules, merge custom frontmatter, and assemble the returned task
  state.
- Archive toggles use `taskArchivePlanning` to plan archive state, frontmatter
  tag changes, and optional archive/tasks folder moves.
- Time-tracking start/stop/delete writes use `taskTimeTrackingPlanning` to
  sanitize legacy entries, choose the active entry to close, validate deleted
  entry indexes, and apply `timeEntries` frontmatter mutations.
- Recurring completion/skip writes use `taskRecurringPlanning` to select the
  action date, update complete/skipped instance arrays, adjust recurrence
  anchors, and advance scheduled/due dates before side effects run.
- Blocking relationship updates use `taskBlockingRelationships` to deduplicate
  changed blocked-task paths and plan reverse `blockedBy` add/remove patches
  before child tasks are written.
- Property-change side effects are coordinated through
  `taskPropertyChangeSideEffects` after the frontmatter write has happened.

Callers should pass typed task creation data into `TaskService`; they should not
reimplement frontmatter filtering, default application, or user-field coercion.

## Cache Principles

Current intent:

- metadata cache remains the primary read accelerator
- plugin-local caches should be derived and invalidatable
- derived caches must never become a second source of truth
- task-file identification and final `TaskInfo` assembly stay in focused
  helpers so cache reads, frontmatter matching, and display defaults are tested
  independently

Refactor rule:

- every plugin-local cache should document:
  - owner
  - key
  - invalidation trigger
  - whether stale reads are acceptable

## Event Flow

Current event propagation uses plugin/task-manager events plus view-level refresh handling.

Refactor direction:

- distinguish domain events from UI refresh events
- normalize event payload types
- keep low-level file events from leaking too far into UI modules

## Bases Boundary

Bases values and entries are not a stable internal domain model. They should be adapted into local TaskNotes types before the rest of the code depends on them.

Refactor rule:

- use local adapter types for the subset of Bases APIs the plugin actually uses
- prefer `unknown` plus narrowing over `any`
- keep Bases-specific value extraction out of general rendering code unless the
  renderer is explicitly responsible for displaying a native Bases value
- keep filter-expression defaults for Bases-created tasks behind
  `basesFilterDefaults`, including task-tag exclusion, mapped core fields,
  custom user-field keys, list properties, and current-file link defaults
- keep default Base file creation and overwrite policy behind a startup/settings
  helper rather than inside the plugin shell
- unregister custom Bases views synchronously during plugin unload so reloads
  cannot remove newly registered view types after startup
- keep shared Bases selection-mode classes, selected-card visuals, keyboard
  shortcuts, click-selection decisions, indicator behavior, and default
  visible-task path extraction behind `basesSelectionUi`

Current adapter seams include:

- calendar task, property, and external-event builders
- calendar mutation planning
- calendar config snapshot construction for refresh/recreate decisions
- calendar data-signature property selection and value normalization
- calendar initial-date and navigation-state planning for recreate decisions
- Kanban task grouping, column/swimlane ordering, drag planning, and
  task-creation default planning
- Task List drag/drop insertion geometry
- Task List grouped render planning and sub-property grouping
- shared Bases formula evaluation and path-property map assembly
- shared Bases selection UI state and click/keyboard selection decisions
- Bases-backed task creation assembly
- TaskCard property access
- TaskCard relationship expansion rendering
- TaskCard metadata assembly
- TaskCard metadata-line toggle wiring
- TaskCard render-state and class assembly
- TaskCard completion-state visual refresh
- TaskCard status/priority indicator rendering
- TaskCard secondary badge and dependency-toggle rendering
- TaskCard title and link rendering
- TaskCard context-menu integration
- TaskCard quick-action service calls
- TaskCard badge and interactive-control helpers
- TaskModal details-editor adapter wiring
- TaskModal title-input behavior
- TaskModal details/right-column layout transitions
- TaskModal mobile focus and keyboard scroll guards
- TaskModal field rendering and visibility dispatch
- TaskModal metadata field construction
- TaskModal organization field construction
- TaskModal project list rendering
- TaskModal subtask list rendering
- TaskModal dependency list state and candidate filtering
- TaskModal task-selector opening for dependency and subtask pickers
- TaskModal action menu-state snapshots and icon-state assembly
- TaskCreationModal initial form-state defaults and pre-populated values
- TaskCreationModal post-save subtask assignment planning
- TaskEditModal initial form-state defaults and cached user-field values
- TaskEditModal frontmatter-cache reads and edit-change input assembly
- TaskEditModal subtask add/remove planning and child project-link updates
- Bases filter defaults for task creation from filtered Base views
- default Bases file creation and regeneration writes

## Date and Recurrence Flow

Date handling is a historically sensitive area.

Refactor rule:

- parsing and coercion should happen at the boundary
- internal logic should use explicit date semantics
- recurrence expansion should remain centralized rather than duplicated in views
- date rollover detection should stay behind `dateChangeDetection`, which owns
  the minute poll, next-midnight timeout, timer registration, and event trigger

Calendar views should build events through normalized event builders before
touching FullCalendar APIs. Drag/drop and resize handlers should ask planning
helpers for explicit mutation plans before performing side effects. Event-mount
list-card rendering and Bases-backed task enrichment belong in
`calendarEventMount`. Initial-date option normalization, property-backed
navigation candidates, and navigation-state snapshots belong in
`calendarInitialDate`; Calendar views keep FullCalendar callback wiring, hover
previews, context menus, and refresh orchestration.

Agenda date sections should ask `agendaTaskSelection` whether a task belongs to
a date or overdue section. `FilterService` keeps task loading and query
filtering, while recurrence expansion, completed-overdue hiding, and
due/scheduled date eligibility live in the helper.

Task sorting should run through `filterTaskSorting`. `FilterService` keeps
metadata-cache access and orchestration while the helper owns sort-key
comparison, time-aware date ordering, natural fallback ordering, tag ordering,
and user-field sort comparison.

Filter predicates should ask `filterPredicateEvaluation` whether a task matches
a query node. `FilterService` keeps cache reads, query planning, grouping,
labels, and option discovery while the helper owns recursive group
evaluation, dynamic user-field coercion, project matching, subtask lookup, and
completion-state semantics.

Filter option assembly should run through `filterOptions`. `FilterService`
keeps option caching and invalidation while the helper owns task-folder
extraction and dynamic user-property definition construction.

Filter query state assembly should run through `filterQueryState`. `FilterService`
keeps validation, cache reads, and execution orchestration while the helper owns
default query construction, quick-toggle query mutation, and saved-query
normalization.

## UI State Flow

TaskCard and TaskModal rendering should consume already-normalized state.

Refactor rule:

- property lookup belongs in access helpers
- input parsing belongs in modal state helpers
- relationship filtering/sorting belongs in relationship helpers
- relationship expansion DOM containers should use injected card renderers
- visible-property metadata assembly belongs in metadata helpers
- metadata-line blocked-by toggle wiring belongs in metadata-line helpers
- target-date, completion, and class-name state belongs in state helpers
- status-click completion refresh, checkbox sync, title completion sync, and
  stale status/priority/project class cleanup belong in completion-state helpers
- status/priority dot visibility, colors, icons, and insertion belong in
  primary-indicator helpers
- recurrence, reminder, project, chevron, and dependency badge rendering belongs
  in secondary-badge helpers
- title text resolution, link rendering, and completion class sync belong in
  title helpers
- context-menu button wiring and native file-menu fallback belong in
  context-menu helpers
- quick-action service calls belong in action helpers
- reusable badge/control DOM behavior belongs in indicator helpers
- Task List drag/drop segmenting, insertion-slot resolution, and drop-target
  reconstruction belong in `taskListDragGeometry`; `TaskListView` keeps DOM
  measurement, drag event handling, and persistence
- Task List grouped-drop frontmatter mutation, status-derived fields, and
  side-effect task snapshots belong in `taskListDropPlanning`; `TaskListView`
  keeps sort-order queueing, vault writes, notices, and refresh orchestration
- Task List grouped render items, sub-property groups, grouped sort-scope paths,
  formula-backed property maps, and group-value stringification belong in
  `taskListGrouping`; `TaskListView` keeps render mode switching, virtualization,
  and DOM updates
- custom user-field input/toggle DOM behavior belongs in user-field control
  helpers
- creation-modal defaults, pre-populated values, default reminders, project
  strings, and user-field defaults belong in creation form-state helpers
- creation-modal subtask project assignment belongs in creation subtask helpers
- edit-modal defaults, identifying tag filtering, recurrence/reminder copies,
  and cached user-field values belong in edit form-state helpers
- edit-modal frontmatter-cache reads and task-change input assembly belong in
  edit change-state helpers
- edit-modal subtask add/remove planning and child project-link mutation belong
  in edit subtask helpers
- modal action-button bar construction and save disabled-state handling belongs
  in action-button helpers
- modal compact action-icon construction and the shared core action-icon set
  belongs in action-bar helpers
- modal compact action-icon active-state, tooltip, and color updates belong in
  action-icon state helpers
- modal date, status, priority, recurrence, and reminder action-menu callbacks
  belong in action-menu helpers
- modal action menu-state snapshots, due/scheduled setter routing, recurrence
  anchor preservation, and icon-state assembly belong in action-state helpers
- modal default status/priority and recurrence action-label derivation belong
  in action-value helpers
- title textarea construction, newline normalization, Enter-key policy, and
  dynamic title height belong in title-input helpers
- details/right-column collapse, expansion, and animation classes belong in
  layout helpers
- title-focus scroll restoration, mobile-like environment checks, and mobile
  keyboard scroll nudges belong in focus-guard helpers
- details-editor markdown lifecycle, tab focus policy, and value sync belong in
  details-editor helpers
- modal field grouping, core-field dispatch, and user-field fallback belong in
  field-rendering helpers
- contexts, tags, and time-estimate field construction belongs in metadata field
  helpers
- project, subtask, and dependency list-field shells belong in organization
  field helpers
- project-string parsing, project item deduplication, project list rendering, and
  project value serialization belong in project state helpers
- subtask candidate filtering, selected-subtask deduplication, removal, and
  cached/fallback list rendering belong in subtask state helpers
- dependency duplicate checks, add/remove behavior, and blocked-by/blocking
  candidate filtering belong in dependency state helpers
- task-selector task loading, empty-state notices, cancellation handling, and
  selector failure logging belong in the task-selector helper; modals keep the
  selected-item state mutation
- filename-safe and storage-safe task title normalization belongs in
  `taskTitleSanitizer`; callers should not strip filename-unsafe characters or
  control characters inline
- single-property normalization and frontmatter mutation rules belong in
  `taskPropertyUpdate`; callers should not duplicate status coercion,
  completed-date derivation, date removal, dependency serialization, or
  date-modified writes inline
- bulk task-update sanitation, recurrence-update planning, mapped frontmatter
  mutation, custom-frontmatter merge/delete semantics, explicit mapped-field
  removals, and returned task-state assembly belong in `taskUpdatePlanning`;
  `TaskUpdateService` keeps vault writes, renames, body writes, cache updates,
  events, webhooks, calendar sync, and auto-archive side effects
- archive tag mutation and archive/tasks move path construction belong in
  `taskArchivePlanning`; `TaskService` keeps the vault write, rename, cache,
  calendar, and webhook side effects
- time-entry sanitization and start/stop/delete frontmatter mutation rules
  belong in `taskTimeTrackingPlanning`; `TaskService` keeps active-session
  checks, vault writes, cache updates, events, and webhooks
- recurring instance action-date selection, complete/skipped array mutation,
  DTSTART updates, and next-occurrence advancement belong in
  `taskRecurringPlanning`; `TaskService` keeps vault writes, body checkbox
  resets, cache updates, events, webhooks, and calendar sync
- blocking relationship path deduplication, reverse `blockedBy` mutation, and
  dependency metadata preservation belong in `taskBlockingRelationships`;
  `TaskService` keeps task cache reads and child task writes
- post-write cache refresh, dependent-task refresh events, webhooks, calendar
  sync, and auto-archive routing belong in `taskPropertyChangeSideEffects`
- Calendar drag/resize frontmatter mutation decisions belong in
  `calendarMutationPlanning`; Calendar views keep event dispatch, vault file
  lookup, and provider/task-service side effects
- Kanban drop frontmatter mutation, status-derived fields, and post-write
  side-effect task snapshots belong in `kanbanDragUtils`; Kanban final
  coordinate drop-target reconstruction and optimistic DOM card movement also
  belong there. Kanban column/swimlane task-creation defaults belong in
  `kanbanCreationDefaults`, while Kanban views keep event wiring, active drag
  state, sort-order service calls, vault writes, notices, and modal entry
  points
- task-frontmatter identification belongs in `taskIdentification`; callers
  should not duplicate tag/property matching, metadata-cache `#` stripping, or
  boolean-like identifier comparison
- mapped task-info defaults, computed tracked time, and blocking flags belong in
  `taskInfoAssembly`; `TaskManager` keeps metadata-cache access, FieldMapper
  calls, and dependency-cache lookups
- custom user-field filter coercion, list-token normalization, sort comparison,
  and group bucket selection belong in `userFieldValues`; `FilterService` keeps
  metadata-cache reads and query orchestration
- filter predicate evaluation belongs in `filterPredicateEvaluation`; callers
  should not duplicate recursive group rules, user-field filter coercion,
  project wikilink matching, `hasSubtasks`, or `status.isCompleted` semantics
- task grouping, project/tag fan-out, date bucket labels, completed-date labels,
  and group header ordering belong in `filterTaskGrouping`; `FilterService`
  injects translation, locale, status, priority, project-resolution, and
  frontmatter-value access
- task sort-key comparison, time-aware date ordering, fallback ordering, tag
  ordering, and user-field sort comparison belong in `filterTaskSorting`;
  `FilterService` injects status, priority, and frontmatter-value access
- filter option assembly, task-folder extraction, and dynamic user-property
  definitions belong in `filterOptions`; `FilterService` keeps cache
  invalidation and source orchestration
- default query construction, quick-toggle condition mutation, and partial query
  normalization belong in `filterQueryState`
- DOM functions should wire controls, render values, and call services

This keeps DOM tests focused on interaction while pure unit tests cover state
rules such as custom field filtering, list parsing, dependency normalization,
and inherited view ordering.

## Operational Principle

When debugging a behavior problem, the first question should be:

"Is this a source-data issue, an adapter issue, a domain-logic issue, or a view-refresh issue?"

The architecture should make that answer obvious. New diagnostics should use
`TaskNotesLogCategory` values so logs preserve the same distinction:

- source-data problems usually map to `validation` or `stale-data`
- adapter/API problems usually map to `provider` or `configuration`
- write-path failures usually map to `persistence`
- unexpected view/service failures usually map to `internal`
