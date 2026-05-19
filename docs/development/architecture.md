# TaskNotes Architecture

This document records the intended high-level boundaries in the TaskNotes plugin.

## Design Goals

- Keep task data markdown-native and portable.
- Isolate Obsidian/Bases/runtime integration from domain logic.
- Minimize direct dependencies on `TaskNotesPlugin`.
- Keep UI modules focused on rendering and interaction, not persistence.

## Main Layers

### Plugin Shell

`src/main.ts`

Owns:

- plugin lifecycle
- settings load/save orchestration through the typed settings persistence helper
- workspace command entry points
- integration registration
- delegation into bootstrap and services

Should not own:

- detailed business logic
- view rendering logic
- low-level task mutation logic
- settings migration and default-merge rules

### Bootstrap

`src/bootstrap/`

Owns:

- service construction
- startup sequencing
- date rollover timer orchestration that emits refresh events
- default Bases file creation/regeneration orchestration
- synchronous Bases view unregistration during plugin unload
- layout-ready initialization
- lazy initialization of optional/heavy services

Should not own:

- business rules
- task parsing
- long-lived presentation behavior

### Settings Persistence

`src/settings/settingsPersistence.ts`

Owns:

- plugin `data.json` path resolution and retry-aware startup reads
- settings-load compromised-state decisions before defaults can be saved
- legacy settings migrations and nested default merging
- settings-only save snapshots that preserve non-settings persisted plugin data

Should not own:

- plugin lifecycle
- settings UI rendering
- runtime side effects that happen after settings are saved

### Domain Services

`src/services/`

Own:

- task creation and mutation
- task creation/update runtime contracts that expose only the app, settings,
  mapper, cache, event, and optional sync surfaces those services need
- filtering runtime contracts that expose only user-field settings, overdue
  policy, i18n, Obsidian link resolution, and project-subtask lookup
- current-note conversion planning for turning note frontmatter and markdown
  body into an edit-modal `TaskInfo`
- task title normalization for filename and frontmatter storage boundaries
- single-property update planning for normalized task values and frontmatter writes
- bulk task-update planning for time-entry sanitation, recurrence adjustments,
  mapped frontmatter mutation, explicit field removals, and returned task state
- archive state and archive move planning
- task start/stop/delete time-entry planning and duration cleanup
- recurring task completion/skip instance planning
- blocking relationship propagation planning
- post-write property-change side effects such as cache refresh, events,
  webhooks, calendar sync, and auto-archive
- filtering, grouping, sorting
- filter predicate evaluation for query groups, user fields, project links,
  subtask lookup, and completion state
- agenda date selection and overdue/recurrence eligibility
- recurrence and time tracking logic
- external provider coordination

Should not own:

- direct DOM rendering
- plugin startup sequencing

### Data Access and Adapters

`src/utils/TaskManager.ts`, `src/bases/`, UI adapter helpers

Own:

- metadata-cache-backed task reads
- task-frontmatter identification and mapped task-info assembly through focused
  helpers
- conversion between Bases data and TaskNotes representations
- frontmatter/property coercion at integration boundaries

Should not own:

- view-specific rendering policy
- unrelated UI decisions

Current extracted examples include:

- `src/utils/taskIdentification.ts` owns tag/property task-frontmatter
  identification, including Obsidian metadata-cache tag prefixes, hierarchical
  task tags, list-valued identifying properties, and boolean-like property
  settings.
- `src/utils/taskInfoAssembly.ts` owns final `TaskInfo` assembly from
  FieldMapper output, including path identity, display defaults, computed
  tracked time, and blocking flags.

### Views, Modals, and UI Components

`src/bases/`, `src/views/`, `src/modals/`, `src/ui/`

Own:

- rendering
- user interaction wiring
- view state persistence/restoration
- invoking service operations

Should not own:

- raw persistence rules
- duplicated query semantics

### Extracted UI State Helpers

UI helpers should isolate state lookup, parsing, and planning from DOM rendering.
Current examples:

- `src/ui/taskCardPropertyAccess.ts` owns TaskCard property lookup across mapped
  core fields, custom properties, Bases values, user fields, and frontmatter.
- `src/ui/taskCardRelationships.ts` owns expanded relationship filtering, view
  order sorting, and dependency path normalization for TaskCard relationship
  sections.
- `src/ui/taskCardRelationshipExpansion.ts` owns TaskCard subtask, blocking,
  and blocked-by expansion containers behind an injected card renderer.
- `src/ui/taskCardMetadata.ts` owns visible-property metadata assembly and
  metadata-line wiring, including blocked/blocking pills, blocked-by toggle
  callbacks, and Google Calendar sync indicators.
- `src/ui/taskCardState.ts` owns TaskCard target-date selection, effective
  status, completion state, and class-name assembly for create/update paths.
- `src/ui/taskCardCompletionState.ts` owns TaskCard completion/status visual
  refresh after status changes, including checkbox state, title completion
  class sync, and stale status/priority/project class cleanup.
- `src/ui/taskCardPrimaryIndicators.ts` owns TaskCard status and priority dot
  visibility, color/icon application, insertion, and update behavior.
- `src/ui/taskCardSecondaryBadges.ts` owns TaskCard recurrence, reminder,
  details, project, chevron, and dependency badge rendering across create/update
  paths.
- `src/ui/taskCardTitle.ts` owns TaskCard title text resolution, link
  rendering, create/update title DOM, and completion class sync.
- `src/ui/taskCardContextMenu.ts` owns TaskCard context-menu button creation,
  fresh task-menu loading, native file-menu fallback, and context-menu
  diagnostics.
- `src/ui/taskCardActions.ts` owns TaskCard quick-action service calls for
  status cycling, priority, recurrence, reminders, and project filtering.
- `src/ui/taskCardIndicators.ts` owns generic TaskCard badge creation, update,
  and no-drag interactive-control behavior.
- `src/bases/taskListDragGeometry.ts` owns Task List drag/drop insertion
  geometry, including contiguous segment grouping, insertion-slot resolution,
  and drop-target reconstruction from measured card baselines.
- `src/bases/taskListGrouping.ts` owns Task List grouped render planning,
  sub-property grouping, grouped sort-scope path assembly, Bases formula-backed
  property lookup, and group-value stringification.
- `src/bases/taskListDropPlanning.ts` owns Task List drop mutation planning for
  grouped frontmatter writes, status-derived fields, and post-write side-effect
  task snapshots.
- `src/bases/kanbanDragUtils.ts` owns Kanban drop target reconstruction,
  optimistic DOM card movement, drop frontmatter planning, status-derived
  fields, and post-write side-effect task snapshots.
- `src/bases/kanbanCreationDefaults.ts` owns Kanban column/swimlane task
  creation default planning, including writable Bases property resolution, list
  default appending, and scalar group-key coercion.
- `src/bases/basesExport.ts` owns shared Bases table export assembly, value
  stringification, TSV/CSV escaping, and export file-name sanitization.
- `src/bases/basesUpdateEvents.ts` owns shared Bases task update/delete event
  relevance decisions, path-rename refresh planning, and rendered-card path
  extraction.
- `src/bases/basesSelectionUi.ts` owns shared Bases selection-mode DOM state,
  selected-card classes, keyboard and click selection decisions, selection
  indicator behavior, and default visible-task path extraction behind a narrow
  selection-service interface.
- `src/modals/taskModalUserFields.ts` owns TaskModal user-field formatting,
  input parsing, custom-frontmatter filtering, and edit-change detection.
- `src/modals/taskModalUserFieldControls.ts` owns TaskModal custom-field
  control construction, input/toggle refs, autocomplete, date-picker wiring,
  and control refresh.
- `src/modals/taskCreationFormState.ts` owns TaskCreationModal initial form
  state from settings defaults and pre-populated values, including default
  dates, projects, reminders, tags, and user-field defaults.
- `src/modals/taskCreationSubtasks.ts` owns TaskCreationModal post-save
  subtask project assignment planning and execution behind injected task lookup
  and update callbacks.
- `src/modals/taskEditFormState.ts` owns TaskEditModal initial form state from
  task data, existing details, settings, and cached frontmatter.
- `src/modals/taskEditChangeState.ts` owns TaskEditModal frontmatter-cache
  reads and edit-change input assembly from modal state plus settings.
- `src/modals/taskEditSubtasks.ts` owns TaskEditModal subtask add/remove
  planning and child project-link updates behind injected task callbacks.
- `src/modals/taskModalDetailsEditor.ts` owns TaskModal details-editor label
  and container creation, markdown-editor callback mapping, tab focus policy,
  value updates, and destroy behavior.
- `src/modals/taskModalActionButtons.ts` owns TaskModal action-button bar
  construction and shared save-button disabled-state handling for creation and
  edit modals.
- `src/modals/taskModalActionBar.ts` owns TaskModal compact action-icon
  construction and the shared core status, priority, due, scheduled,
  recurrence, and reminder action icon set.
- `src/modals/taskModalActionIconStates.ts` owns TaskModal compact action-icon
  active-state, tooltip, configured-color, and stale-color cleanup behavior.
- `src/modals/taskModalActionMenus.ts` owns TaskModal date, status, priority,
  recurrence, and reminder action-menu construction and selection callbacks.
- `src/modals/taskModalActionValues.ts` owns TaskModal default status/priority
  derivation and modal-specific recurrence action-label formatting.
- `src/modals/taskModalActionState.ts` owns TaskModal action menu-state
  snapshots, menu-context setter routing, recurrence-anchor preservation, and
  icon-state assembly from settings.
- `src/modals/taskModalTitleInput.ts` owns TaskModal title textarea creation,
  newline normalization, Enter-key policy, dynamic height calculation, and CSS
  property application.
- `src/modals/taskModalLayout.ts` owns TaskModal details/right-column collapse
  and expansion class transitions, including the expansion animation state.
- `src/modals/taskModalFocusGuards.ts` owns TaskModal title-focus scroll
  restoration, mobile-like environment checks, mobile keyboard scroll nudges,
  and focus-cleanup timers.
- `src/modals/taskModalFieldRenderer.ts` owns ordered TaskModal field-group
  rendering, core-field dispatch, user-field fallback, and ignored-field
  reporting.
- `src/modals/taskModalMetadataFields.ts` owns TaskModal contexts, tags, and
  time-estimate field construction, including autocomplete attachment, tag
  sanitization, input refs, and mobile keyboard guards.
- `src/modals/taskModalOrganizationFields.ts` owns TaskModal project, subtask,
  and dependency list-field shells, translated button copy, ghost button
  styling, and list-element reuse.
- `src/modals/taskModalProjects.ts` owns TaskModal project item creation,
  project-string parsing, deduplication keys, removal, resolved/unresolved list
  rendering, and serialized value assembly.
- `src/modals/taskModalSubtasks.ts` owns TaskModal subtask candidate filtering,
  duplicate prevention, removal, selected-path checks, and cached/fallback list
  rendering.
- `src/modals/taskModalDependencies.ts` owns TaskModal dependency item
  add/remove behavior, duplicate checks, and blocked-by/blocking candidate
  filtering, alongside dependency list rendering.
- `src/modals/taskModalTaskSelector.ts` owns shared TaskModal task-selector
  opening for dependency and subtask pickers, including task loading,
  no-eligible notices, cancellation guards, and selector failure logging behind
  injected selector/notice hooks.

TaskCard and TaskModal should continue moving toward rendering and interaction
wiring only. New state helpers should use narrow interfaces or plain data
structures instead of importing `TaskNotesPlugin` unless they truly need plugin
runtime services. When a helper does need runtime services, keep the surface
action-specific rather than mixing service calls into DOM construction.

## Important Boundaries

### Task Mutations

Task creation, update, recurrence transitions, archive toggles, and relationship writes should flow through `TaskService` and its collaborators, not ad hoc UI code.

`TaskCreationService` and `TaskUpdateService` should depend on their exported
runtime interfaces instead of the full `TaskNotesPlugin` type. The facade can
still pass the plugin object structurally, but the service contract should make
the required app/settings/mapper/cache/event/sync surface explicit.

Task-title sanitization belongs in `src/services/task-service/taskTitleSanitizer.ts`
so filename safety and stored-title safety stay explicit and independently
tested.

Single-property update planning belongs in
`src/services/task-service/taskPropertyUpdate.ts` so status completion dates,
checkbox-backed status values, empty date cleanup, dependency serialization, and
date-modified writes stay explicit before `TaskService` performs the vault
write.

Bulk task-update planning belongs in
`src/services/task-service/taskUpdatePlanning.ts` so edit-modal/API update
payloads sanitize legacy time-entry duration fields, plan recurrence
scheduled/due/DTSTART adjustments, apply mapped frontmatter removals, preserve
custom frontmatter semantics, and assemble the returned `TaskInfo` before
`TaskUpdateService` performs vault writes and side effects.

Archive state and archive move planning belongs in
`src/services/task-service/taskArchivePlanning.ts` so archive tag toggling,
date-modified writes, and archive/tasks destination path construction stay
tested outside the Obsidian file-move side effects.

Time-tracking start/stop planning belongs in
`src/services/task-service/taskTimeTrackingPlanning.ts` so active time-entry
selection, legacy duration cleanup, end-time writes, delete-index validation,
and `timeEntries` frontmatter mutation rules stay tested outside the
active-session, vault-write, cache, event, and webhook side effects.

Recurring task completion/skip planning belongs in
`src/services/task-service/taskRecurringPlanning.ts` so action-date selection,
complete/skipped instance mutation, DTSTART updates, next scheduled/due
advancement, and recurrence frontmatter writes stay tested outside vault writes,
body checkbox resets, cache, events, webhooks, and calendar sync.

Blocking relationship propagation planning belongs in
`src/services/task-service/taskBlockingRelationships.ts` so blocked task path
deduplication, reverse `blockedBy` add/remove decisions, relative dependency
link construction, and raw dependency metadata preservation stay tested outside
cache reads and child task writes.

Post-write property side effects belong in
`src/services/task-service/taskPropertyChangeSideEffects.ts`; `TaskService`
keeps the public facade used by views, while the collaborator owns cache
refresh, dependent-task refresh events, webhooks, calendar sync, and
auto-archive routing.

### Filtering and Grouping

Query planning, predicate evaluation, sorting, grouping, and label formatting should be separate concerns even if they remain behind the same facade during migration.

Current extracted examples:

- `src/services/filter-service/FilterQueryPlanner.ts` owns index-backed
  candidate task selection before `FilterService` evaluates complete filter
  predicates.
- `src/services/filter-service/userFieldValues.ts` owns custom user-field list
  token normalization, filter-value coercion, sort comparison, group bucket
  selection, and hierarchical group labels without depending on the plugin or
  Obsidian metadata cache.
- `src/services/filter-service/filterTaskGrouping.ts` owns task grouping,
  project/tag fan-out, date bucket labels, completed-date labels, and group
  header ordering behind injected translation, locale, status, priority,
  project-resolution, and frontmatter-value callbacks.
- `src/services/filter-service/filterTaskSorting.ts` owns task sorting, date
  comparison, natural fallback ordering, tag ordering, and user-field sort
  comparison behind injected status, priority, and frontmatter-value callbacks.
- `src/services/filter-service/filterOptions.ts` owns filter-option assembly,
  task-folder extraction, and dynamic user-property definitions behind injected
  status, priority, cache-derived option, task-path, root-label, and user-field
  sources.
- `src/services/filter-service/filterQueryState.ts` owns default filter query
  construction, quick-toggle query mutation, and partial query normalization.

### Bases Integration

Treat Bases as an integration boundary. TaskNotes should normalize the subset of Bases APIs it depends on into local adapter types rather than spreading `any`-based access across views.

Current extracted examples include Calendar event builders, event-mount list-card
rendering, property-event mutation planning, config snapshots, and
data-signature helpers, initial-date/navigation planning, Kanban task grouping,
column/swimlane ordering, and drag planning, Kanban task-creation default
planning, Task List drag/drop insertion geometry, Task List grouped render
planning, shared Bases selection UI behavior, Bases task creation assembly,
filter-default extraction for Bases-created tasks, Kanban drop status-derivative
and side-effect planning, shared Bases formula/property-map adapters, TaskCard
property access, TaskCard relationship expansion rendering, TaskCard metadata
assembly and metadata-line adapter wiring, TaskCard render-state assembly,
TaskCard completion-state refresh, TaskCard primary indicator rendering,
TaskCard secondary badge rendering, TaskCard title/link rendering, TaskCard
context-menu integration, TaskCard quick-action wiring, and TaskCard indicator
helpers, plus TaskModal action state/menu
adapters, creation form-state defaults, creation subtask assignment, edit
form-state defaults, edit-change state assembly, edit subtask mutation
planning, title-input behavior, details/right-column layout transitions, mobile
focus/keyboard guards, details-editor adapter wiring, field-rendering dispatch,
metadata field construction, and organization list-field construction.

### Logging and User Notices

Diagnostics should route through `createTaskNotesLogger(...)` from
`src/utils/tasknotesLogger.ts` when a module needs structured context, debug
gating, or a category suitable for triage.

Use the shared categories consistently:

- `validation`: invalid input or unsupported values
- `persistence`: vault, frontmatter, or write failures
- `provider`: external integration or host API failures
- `configuration`: missing settings, unavailable plugins, or incompatible APIs
- `stale-data`: cache or metadata freshness issues
- `internal`: unexpected TaskNotes logic failures

Debug logs must be gated by `settings.enableDebugLogging` where plugin settings
are available. Warnings and errors should include an `operation` and optional
structured `details` rather than assembling ad hoc console strings.

Current Phase G examples include Bases API/view diagnostics, Kanban drag debug
events, TaskCard context-menu failures, task-link detection, and markdown-widget
context checks.

## Migration Direction

The refactor strategy is incremental:

1. move construction and startup orchestration out of `src/main.ts`
2. split large service modules behind stable facades
3. tighten types at integration edges
4. split large UI modules after domain seams are clearer
5. record new seams in focused tests and the refactor smoke checklist

The goal is not a rewrite. The goal is to reduce coupling while preserving behavior.
