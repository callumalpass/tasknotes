# TaskNotes legacy feature porting plan

## Scope and comparison basis

This inventory compares local `main` (`7011e683`, TaskNotes v5 documentation rebuild, 2026-07-27) with the legacy custom branch `task-view-keyboard-and-project-mgmt` (`9e539ac3`).

The common ancestor is `11f2e074` (TaskNotes 3.x). The legacy branch contains 65 non-merge commits after that ancestor. Current `main` has since moved to the TaskNotes v5/Bases architecture, so this is a behavioral inventory rather than a cherry-pick plan.

Disposition meanings:

- **Port**: behavior is still absent and fits current product semantics.
- **Redesign**: preserve the user outcome, but implement it through v5 services, Bases views, settings, and field abstractions.
- **Drop**: obsolete, superseded, or too tightly tied to removed architecture.
- **Upstream**: current `main` already provides the behavior independently; retain upstream and add only missing deltas.

No application code was changed as part of this investigation.

## Executive summary and recommended sequence

1. **Jira integration** remains substantially absent and should be redesigned as a self-contained integration slice.
2. **Keyboard-first task-list operation** remains only partly covered. Upstream has batch selection but not the legacy persistent focus model or action key map. Redesign it around `src/bases/TaskListView.ts`, `TaskSelectionService`, and current command/action coordinators.
3. **Configurable task-list shortcuts** are absent. Add them only after the action layer is separated from keystroke recognition.
4. **Story points** are absent as a first-class field, but v5 user fields overlap strongly. Decide whether a dedicated story-points experience is still worth maintaining before implementation.
5. **Manual ordering, parent-note project defaults, modal save shortcuts, batch actions, and several correctness fixes** have upstream equivalents and should not be copied from the legacy branch.

The safest delivery order is: Jira core mapping tests → Jira UI/import flow → keyboard focus/navigation → keyboard task actions → shortcut settings → any approved story-points specialization.

---

## 1. Jira integration

### 1.1 Import Jira issue command and dependency adapter

- **Behavior:** Prompt for an issue key, call the `obsidian-jira-issue` plugin API, map the result, and create a TaskNotes task. Report missing-plugin, fetch, and creation errors.
- **Legacy commits:** `41537644` (initial import); `329e062c` (Jira type roots); `88435da7` (compilation); `3e7d8b22`, `9e539ac3` (localization fixes).
- **Legacy files:** `src/main.ts`; `src/modals/JiraIssueModal.ts`; `src/types/obsidian-jira-issue.d.ts`; `package.json`; translations.
- **Likely current files:** `src/commands/taskNotesCommands.ts`; `src/commands/TranslatedCommandRegistry.ts`; a new `src/services/JiraImportService.ts` or integration module; `src/modals/TextInputModal.ts` or a small Jira modal; `src/services/task-service/TaskCreationService.ts`; `src/types/settings.ts`; `src/settings/tabs/integrationsTab.ts`; locales.
- **Disposition:** **Redesign.** Keep the optional plugin dependency behind a typed adapter/service. Do not restore import logic in the monolithic plugin entry point. Use current task creation and notice/error abstractions.
- **Difficulty / risks:** **Medium-high.** The external plugin API is not under TaskNotes control; plugin discovery and API shape can drift. Import must avoid partial notes, honor current field mapping, folder/template rules, and mobile/desktop availability.
- **Tests:** Legacy added no meaningful automated coverage. Add adapter tests for missing/malformed API, issue-key validation, fetch failure, and successful handoff to task creation; command registration/localization tests; an integration test proving exactly one valid note is created.

### 1.2 Configurable Jira-to-TaskNotes field mapping

- **Behavior:** Configure scalar and array mappings using fixed values, paths, and templates; remap enum values; supply sensible defaults for title, ID, details, dates, status, priority, estimate, tags, contexts, and projects.
- **Legacy commits:** `2dac5cb6` (settings tab); `c1cdcf9b` (defaults); `d36c694b` (save fixes); `3e7d8b22`, `749baaf6`, `9e539ac3` (localization).
- **Legacy files:** `src/settings/tabs/jiraFieldMappingTab.ts`; `src/utils/JiraMapping.ts`; `src/services/FieldMapper.ts`; `src/settings/defaults.ts`; `src/types/settings.ts`; `src/settings/TaskNotesSettingTab.ts`; translations; `styles/settings-view.css`.
- **Likely current files:** a new Jira-specific mapper beside `src/core/fieldMapping.ts` rather than extending the core mapper; `src/settings/tabs/integrationsTab.ts`; `src/settings/settingsPersistence.ts`; `src/settings/settingsMigration.ts`; `src/types/settings.ts`; current field definitions/user-field utilities.
- **Disposition:** **Redesign.** Keep external-source transformation separate from YAML field mapping. Support current built-in fields and v5 user fields by stable property ID. Version the settings shape and validate it on load.
- **Difficulty / risks:** **High.** The legacy settings UI is large and mutable; arbitrary dotted paths/templates can produce unsafe or surprising types. Mapping project links, statuses, priorities, and user fields needs explicit coercion and validation. Existing saved legacy settings may require migration.
- **Tests:** Add pure tests for path lookup, template rendering, array normalization, enum remapping, missing/null values, malformed templates, prototype-pollution-resistant lookup, and conversion to `TaskCreationData`. Add persistence/migration tests and settings UI tests for save/reset behavior.

### 1.3 Live mapping previews and raw issue JSON

- **Behavior:** Fetch a sample issue, show each mapping’s resolved value, and expose raw JSON for reference.
- **Legacy commits:** `012ffa45` (previews); `53859732` (raw JSON); `d36c694b` (save bugs); localization commits above.
- **Legacy files:** `src/settings/tabs/jiraFieldMappingTab.ts`; `src/utils/JiraMapping.ts`; `styles/settings-view.css`.
- **Likely current files:** `src/settings/tabs/integrationsTab.ts` plus new Jira settings components; the Jira adapter/service; reusable settings card components.
- **Disposition:** **Port with redesign.** Keep fetch state ephemeral; render JSON as text, never HTML; debounce or require an explicit fetch; avoid persisting sample issue data or credentials.
- **Difficulty / risks:** **Medium.** Large issues can make settings sluggish or leak sensitive Jira content on screen/logs. Preview must distinguish missing values from empty arrays and invalid mappings.
- **Tests:** Mapping preview snapshot/DOM tests, raw JSON escaping, loading/error states, no persistence of sample data, and large-payload truncation/collapse behavior.

### 1.4 Jira backlink, safe title, and current-note project

- **Behavior:** Sanitize imported filenames, insert the Jira issue URL/backlink, and use the active/parent note as project when the relevant default is enabled.
- **Legacy commits:** `5b8b1cbc` (current-note project); `f64ad7a4` (sanitize title); `e7d45f1d` (backlink); `8294574c` (consolidate active-note setting).
- **Legacy files:** `src/main.ts`; `src/services/FieldMapper.ts`; `src/utils/JiraMapping.ts`; task creation helpers.
- **Likely current files:** `src/services/task-service/taskTitleSanitizer.ts`; `src/services/task-service/taskCreationDefaults.ts`; `src/utils/taskCreationPrepopulation.ts`; `src/services/task-service/TaskCreationService.ts`; Jira mapper/service.
- **Disposition:** **Redesign / reuse upstream.** Use current filename generation and task-creation defaults. Add the backlink through mapped `details` or a clearly configured user field; do not duplicate current-note project logic.
- **Difficulty / risks:** **Medium.** Jira summary, issue key, and URL must not enable path traversal or invalid filenames. Details injection must preserve Markdown and avoid duplicate backlinks on retry.
- **Tests:** Invalid filename characters/reserved names, duplicate imports/retries, URL escaping, details preservation, project default enabled/disabled, and explicit mapped projects taking precedence.

---

## 2. Keyboard navigation

### 2.1 Persistent task focus and arrow navigation

- **Behavior:** A task-list view retains a focused task, shows a distinct focused state, moves focus with arrows, scrolls it into view, and restores predictable focus after rerender.
- **Legacy commits:** `61bc3ac9` (focus/navigation foundation); `78e4a4b8` (visible selection state); `aeba342c` (multiple rendered instances); `254c2f97` (Escape/focus handling).
- **Legacy files:** `src/views/TaskListView.ts`; `src/ui/TaskCard.ts`; `styles/task-card-bem.css`; `src/utils/MultiMap.ts`.
- **Likely current files:** `src/bases/TaskListView.ts`; `src/bases/basesSelectionUi.ts`; `src/services/TaskSelectionService.ts`; `src/ui/taskCardState.ts`; task-card styles; possibly a new small `TaskListKeyboardController`.
- **Disposition:** **Redesign.** Keep keyboard focus (roving `tabindex`/active descendant) separate from selection. Key identity by task path and rendered group instance. Integrate with virtualized/rerendered Bases DOM.
- **Difficulty / risks:** **High.** Accessibility, embedded Bases views, repeated task cards, collapsed groups, virtual scrolling, input focus, and view teardown all complicate focus restoration. Do not globally trap arrows when a user is editing/searching.
- **Tests:** Pure focus state reducer tests; DOM tests for ArrowUp/Down, Home/End, group boundaries, repeated paths, collapsed groups, rerender restoration, scrolling, and cleanup; accessibility assertions for focus attributes and visible classes.

### 2.2 Single/multi-selection and “selected or focused” targeting

- **Behavior:** Space/toggle selection, visible checkboxes, select-all/range behavior, and a consistent rule that commands target selected tasks when any exist, otherwise the focused task.
- **Legacy commits:** `61bc3ac9`, `78e4a4b8`; `4fb72fa4` (shared target resolver); `7f9e18ab`, `43f34011` (selected-task drag behavior).
- **Legacy files:** `src/views/TaskListView.ts`; `src/ui/TaskCard.ts`; styles.
- **Likely current files:** `src/services/TaskSelectionService.ts`; `src/bases/basesSelectionUi.ts`; `src/bases/TaskListView.ts`; `src/components/BatchContextMenu.ts`; new keyboard action controller.
- **Disposition:** **Upstream overlap plus ported delta.** Current main independently provides batch selection, selection visuals, Shift+Arrow range selection (`5dd09aa9`), and batch context actions. Retain those. Add only keyboard focus and a shared resolver that respects existing `TaskSelectionService`.
- **Difficulty / risks:** **Medium-high.** Legacy semantics used checkboxes more aggressively than upstream. Avoid introducing two selection stores or changing click behavior unexpectedly.
- **Tests:** Extend current selection tests for focused fallback, selected precedence, selection persistence across refresh, and no operation when neither target exists. Do not recreate already-covered selection tests.

### 2.3 Keyboard task action set

- **Behavior:** Create, open, edit, filter, due/scheduled date, priority, status, recurrence, tags, contexts, projects, deletion, and Shift+Enter open-note actions from the list.
- **Legacy commits:** `54d6bdf2`; `7b2c3504`; `11019040`; `c3b6ea00`; `867b2976`; `7a0e7eb2`; `afe5f2db`; `09451023`; `1ea2fa56`; localization commits.
- **Legacy files:** `src/views/TaskListView.ts`; array-capable date/status/recurrence modals; `src/modals/TagsModal.ts`; `src/modals/ContextsModal.ts`; `src/modals/ProjectSelectModal.ts`; context-menu components.
- **Likely current files:** `src/bases/TaskListView.ts`; `src/ui/TaskActionCoordinator.ts`; `src/ui/taskCardActions.ts`; `src/components/BatchContextMenu.ts`; current date/status/priority/project menus; `src/modals/TaskActionPaletteModal.ts`; `src/commands/taskNotesCommands.ts`.
- **Disposition:** **Redesign.** Define semantic task-list actions once and route keyboard shortcuts, context menus, and the action palette into them. Reuse current batch operations and current modal/menu primitives. Context assignment may now be a tag or user-field action depending on v5 configuration.
- **Difficulty / risks:** **High.** The legacy action list assumes v3 built-in fields and removed array modals. Batch mutation must use current mutation services, recurring-instance semantics, and confirmations. Shortcut keys must not fire inside search fields, editors, menus, or unrelated Bases.
- **Tests:** Table-driven action routing for selected/focused/no target; one focused and multiple selected integration cases for every destructive or mutating action; recurring-task behavior; cancellation; delete confirmation; Shift+Enter workspace navigation; input/contenteditable suppression.

### 2.4 Menu/modal lifecycle and keyboard ownership

- **Behavior:** Suspend list keys while a menu/modal owns input, restore list behavior on close, close filter popups with Backspace, and keep Escape from accidentally discarding list focus.
- **Legacy commits:** `ec217c27` (observer handles modal/menu close); `867b2976` (filter popup); `aa8eab41` (observer refactor); `254c2f97` (Escape).
- **Legacy files:** `src/utils/InputObserver.ts`; `src/views/TaskListView.ts`; `src/ui/FilterBar.ts`; `src/main.ts`.
- **Likely current files:** a view-scoped keyboard controller; `src/bases/components/SearchBox.ts`; `src/bases/basesSearchUi.ts`; current modal focus utilities; Obsidian workspace/menu lifecycle hooks.
- **Disposition:** **Redesign.** Do not restore a document-wide `MutationObserver` as the primary state model. Prefer event-path checks, view containment, explicit modal/menu lifecycle, and teardown registered by the view.
- **Difficulty / risks:** **High.** Obsidian menus are portal-like and third-party modals are not owned by TaskNotes. Mobile soft keyboards and IME composition require care.
- **Tests:** Modal/menu open/close, nested menus, Escape and Backspace, IME composition, focus in search/editor/contenteditable, view close/reopen, and listener leak checks.

### 2.5 Configurable task-list shortcuts

- **Behavior:** Defaults, parsing, persistence, conflict display, localized labels, and a dedicated shortcut editor for every task-list action.
- **Legacy commits:** `5c504f5e` (settings); `d3e285eb`, `3a3a0ea6`, `ace89577` (UI); `aa8eab41` (parser); `2acb7433`, `8c0ce6c4` (save/default fixes); `3e7d8b22` (localization).
- **Legacy files:** `src/settings/KeyboardShortcutsMap.ts`; `src/settings/tabs/keyboardShortcutTab.ts`; `src/types/settings.ts`; `src/settings/defaults.ts`; `src/settings/TaskNotesSettingTab.ts`; `styles/settings-view.css`; translations.
- **Likely current files:** `src/settings/tabs/featuresTab.ts` or a new keyboard section; `src/settings/settingsPersistence.ts`; `src/settings/settingsMigration.ts`; `src/commands/types.ts`; new shortcut normalization utility; locales.
- **Disposition:** **Redesign.** Store normalized key chords by semantic action ID. Use Obsidian command hotkeys where global commands are appropriate, and custom view-local bindings only for focus-dependent actions. Provide reset and conflict validation.
- **Difficulty / risks:** **High.** Cross-platform Ctrl/Meta naming, keyboard layouts, reserved browser/Obsidian shortcuts, multi-key sequences, and migration from legacy strings are the main risks.
- **Tests:** Parser/serializer round trips, modifier normalization, Mac/Windows display, invalid/conflicting bindings, reset/defaults, persistence across reload, legacy setting migration, localization completeness, and input suppression.

### 2.6 Mouse move task focus
- Hovering on a task card should behave like keyboard cursoring. You should be able to move your mouse around the list using the toggle selection hotkey to select a group of tasks.
    - A mouse move should give focus to the task under the hover unless there are no tasks under the cursor, in which case focus should not change. For example, I should be able to hover over items pressing "space" to toggle selection for items similar to the Linear desktop app
    - Pressing one of the navigation hotkeys like an up/down arrow or home/end should switch back to applying focus with the keyboard
    - Pressing the selection toggle hotkey should toggle selection of whatever has hover focus if the last event was mouse move or keyboard focus if the last event was keyboard navigation.

### 2.7 Task view project assignment editing
- [x] Add project dialog can remove projects in addition to adding them. (I had implemented this for TaskNotes version 3.x in commit `095a97a315d125c3c5dda9c05a8464eb64a6e35e`, although that implementation had some issues so be circumspect about whether this approach still applies.)
- [ ] Dropping a task into a different project (and probably any other list-valued grouping property -- list valued like projects as opposed to single value at a time like status) assigns the project without a link in the yaml, e.g.
```yml
projects:
  - Make TaskNotes into Linear
```
but assigning the task using the note editor dialog wraps the project name in a link
```yml
projects:
  - "[[Make TaskNotes into Linear]]"
```
The dialog editor is probably right. Update the code so that they both use the same method to assign a project -- either raw name or link -- spreferably via the same code path. If one implementation or the other is more correct, use the correct implementation.
- [x] When grouping by project, dragging a task from one project and dropping into another should overwrite the tasks projects with the dropped project. Currently it sometimes moves the task to a new project, and sometimes it just assigns the new project and preserves the old project. This behavior already seems to work properly for dragging between single-value properties like status, but not for projects which has a list of values.

---

## 3. Other user-visible features

### 3.1 Story-point estimation

- **Behavior:** Numeric points field, default, creation/editing, `^3` NLP syntax, context-menu and keyboard assignment, display, and sorting.
- **Legacy commits:** `1f347258` (schema); `9eaff5bf` (modal); `7ff984aa` (context menu); `814c6ae6`, `3c89eb2b` (defaults/creation); `96c80e6e` (NLP); `5f47b15a` (render/sort); localization commits.
- **Legacy files:** `src/types.ts`; `src/types/settings.ts`; `src/modals/StoryPointsModal.ts`; `src/services/NaturalLanguageParser.ts`; `src/services/FilterService.ts`; `src/ui/TaskCard.ts`; `src/components/TaskContextMenu.ts`; `src/settings/tabs/defaultsTab.ts`; field mapping/defaults/translations.
- **Likely current files:** v5 user-field definitions and modal controls (`src/modals/taskModalUserFields.ts`, `src/settings/tabs/taskProperties/userFieldsCard.ts`, `src/utils/userFieldUtils.ts`); NLP trigger configuration; Bases property display/sort; quick actions.
- **Disposition:** **Redesign, pending product decision.** First test whether a configured numeric user field named “Story points” supplies storage, modal editing, Bases display, and sorting. If so, add only a reusable numeric quick action/default/NLP trigger rather than a hard-coded core property. Port `^N` only if that syntax is still desired and does not conflict with configurable NLP triggers.
- **Difficulty / risks:** **Medium-high.** A first-class field creates permanent schema/API/i18n obligations; a user-field implementation may not provide Fibonacci choices, defaulting, or ergonomic action menus. `^` can conflict with user text or other syntax.
- **Tests:** Numeric validation (zero, decimal, negative, large, clear); creation default precedence; NLP extraction/title cleanup; user-field mapping; sort with missing values; display visibility; batch edit; serialization.

### 3.2 Manual ordering and multi-task drag

- **Behavior:** Persistent ordering within/across groups, end-of-list drops, ascending/descending order, and moving selected tasks as a block.
- **Legacy commits:** `273cc8f6`; `a71be1a1`; `0ba12282`; `0c3c07ab`; `a9ac1d0b`; `51437904`; `d43e4fb5`; `7f9e18ab`; `43f34011`; `f83b3a4b`; `1dc0edae`; `dc150503`.
- **Legacy files:** `src/ui/DragDropHandler.ts`; `src/views/TaskListView.ts`; `src/services/TaskService.ts`; `src/services/FilterService.ts`; `src/types.ts`; `src/main.ts`; cache/view optimization files.
- **Likely current files:** `src/bases/TaskListView.ts`; `src/bases/sortOrderUtils.ts`; `src/bases/manualOrderState.ts`; `src/bases/taskListDragGeometry.ts`; `src/bases/taskListDropPlanning.ts`; `src/bases/kanbanDragUtils.ts`.
- **Disposition:** **Mostly upstream; drop legacy implementation.** Current main uses string LexoRank-style values, group-aware drop planning, optimistic cache updates, and extensive unit tests. Never port legacy numeric spacing or cache-refresh code. Evaluate only the missing “drag all selected tasks as one block” behavior; current task-list code appears to plan a single dragged path.
- **Difficulty / risks:** **Medium** for the selected-block delta, **very high** if the upstream rank engine is disturbed. Multi-group selection needs a precise rule for target group properties and relative order.
- **Tests:** Reuse current manual-order suites. Add selected-block tests for contiguous/noncontiguous selection, multiple source groups, drop at start/end, ascending/descending, filtered views, rollback on partial write failure, and exact group-property updates.

### 3.3 Project-aware task workflows

- **Behavior:** Use parent/current note as project for creation/import/conversion, assign projects from task list/context menu, and honor filter-bar properties in project subtask lists.
- **Legacy commits:** `7a0e7eb2`; `c9a4f5a0`; `5b8b1cbc`; `8294574c`; `065bc49c`; `095a97a3`.
- **Legacy files:** `src/main.ts`; `src/modals/ProjectSelectModal.ts`; `src/services/InstantTaskConvertService.ts`; `src/editor/ProjectNoteDecorations.ts`; `src/services/FilterService.ts`; `src/ui/TaskCard.ts`.
- **Likely current files:** `src/utils/taskCreationPrepopulation.ts`; `src/services/task-service/taskCreationDefaults.ts`; `src/services/InstantTaskConvertService.ts`; `src/services/ProjectSubtasksService.ts`; `src/modals/ProjectSelectModal.ts`; `src/ui/taskCardContextMenu.ts`; quick-action project assignment.
- **Disposition:** **Upstream with small verification gaps.** Current main independently implemented parent-note project defaults (`77745914`, `47f99ea2`), inline conversion support, project quick actions (`cac4f5e1`), and broad project/subtask tests. Jira should call those abstractions. Drop the legacy modal-specific implementation.
- **Difficulty / risks:** **Low-medium** verification; projects have evolved into relationship-aware semantics and must not be reduced to old string arrays.
- **Tests:** Rely on current project test suites; add only Jira import precedence and keyboard batch-project action tests. Verify project subtask property filters with current Bases filters before claiming a gap.

### 3.4 Creation modal NLP prepopulation and parsed title

- **Behavior:** Seed the natural-language input when opening task creation and populate title/fields from parsing.
- **Legacy commits:** `bf0e2338` (prepopulate); `63fff798` (parsed title).
- **Legacy files:** `src/modals/TaskCreationModal.ts`; `src/modals/TaskModal.ts`; `src/services/NaturalLanguageParser.ts`.
- **Likely current files:** `src/utils/taskCreationPrepopulation.ts`; `src/modals/taskCreationData.ts`; `src/modals/taskCreationFormState.ts`; `src/services/buildTaskCreationDataFromParsed.ts`; `src/modals/TaskCreationModal.ts`.
- **Disposition:** **Upstream.** Current main has explicit prepopulation and parsed-data builders. Drop legacy changes.
- **Difficulty / risks:** **Low** verification only.
- **Tests:** Current creation/NLP suites should cover this. Add a regression only if a concrete legacy input differs.

### 3.5 Modal and menu ergonomics

- **Behavior:** Ctrl/Cmd+Enter saves edits; Shift+Enter opens task notes; context menus remain inside the viewport; selection dialogs exclude already-applied tags/contexts.
- **Legacy commits:** `f0ba6049`; `afe5f2db`; `5010e4bc`; `37d7e06e`.
- **Legacy files:** `src/modals/TaskEditModal.ts`; `src/views/TaskListView.ts`; `src/ui/TaskCard.ts`; `src/modals/TagsModal.ts`; `src/modals/ContextsModal.ts`.
- **Likely current files:** `src/modals/TaskEditModal.ts`; `src/components/ContextMenu.ts`; `src/modals/taskModalSuggests.ts`; `src/utils/taskTagFiltering.ts`; keyboard action controller.
- **Disposition:** **Mixed.** Ctrl/Cmd+Enter is upstream in current creation/edit modals. Modern Obsidian/context-menu primitives and current tag filtering likely supersede the old viewport and modal fixes; verify, then drop. Shift+Enter open-note remains part of the keyboard action port.
- **Difficulty / risks:** **Low-medium.** Avoid duplicate global key handlers and platform-specific regressions.
- **Tests:** Existing modal save tests plus a focused Shift+Enter action test; viewport test at all window edges only if current `ContextMenu` does not already guarantee it; tests that applied tags are not re-suggested.

---

## 4. Refactors or infrastructure changes

### 4.1 `InputObserver` and keyboard shortcut map abstractions

- **Legacy commits:** `ec217c27`; `aa8eab41`; `254c2f97`; shortcut persistence fixes.
- **Legacy files:** `src/utils/InputObserver.ts`; `src/settings/KeyboardShortcutsMap.ts`; `src/main.ts`.
- **Likely current files:** new view-scoped keyboard controller and pure shortcut utility; current bootstrap/service registration only if shared state is necessary.
- **Disposition:** **Drop structure, redesign responsibilities.** `InputObserver` was coupled to v3 DOM and globally registered from `main.ts`. Preserve its behavioral lessons—input suppression and lifecycle restoration—but not the class.
- **Difficulty / risks:** **High** if implemented globally; **medium** if scoped per Bases view with explicit teardown.
- **Tests:** Controller lifecycle, event ownership, IME, editor/search exclusions, and shortcut normalization.

### 4.2 `MultiMap` for repeated task DOM elements

- **Legacy commits:** `aeba342c`; related task rendering fixes.
- **Legacy files:** `src/utils/MultiMap.ts`; `src/views/TaskListView.ts`.
- **Likely current files:** Bases view render/cache structures and DOM queries keyed by `data-task-path`.
- **Disposition:** **Drop.** The generic 357-line collection was an implementation workaround for the removed v3 view. If repeated-card coordination is needed, use a narrowly typed `Map<string, Set<HTMLElement>>` local to the view or query rendered instances.
- **Difficulty / risks:** **Low.** Risk is reintroducing stale DOM references and leaks.
- **Tests:** Repeated task paths in multiple groups and cleanup after rerender.

### 4.3 Batch property updates, cache invalidation, and refresh optimization

- **Legacy commits:** `a9ac1d0b`; `d43e4fb5`; `01a5dc54`; `ab16f202`; `0e4bd5a5`.
- **Legacy files:** `src/services/TaskService.ts`; `src/utils/MinimalNativeCache.ts`; `src/utils/viewOptimizations.ts`; `src/main.ts`; API controllers.
- **Likely current files:** `src/core/VaultMutationService.ts`; `src/services/VaultMutationService.ts`; `src/services/task-service/taskPropertyUpdate.ts`; Bases refresh/update lifecycle helpers; `TaskSelectionService`; batch context actions.
- **Disposition:** **Upstream / drop legacy infrastructure.** Current main removed `MinimalNativeCache`, added mutation services and Bases refresh lifecycles, and has batch actions. Any new keyboard/Jira mutations must use these paths.
- **Difficulty / risks:** **High** if bypassed. Partial batch failure, recurring instances, optimistic state, and event coalescing are the key risks.
- **Tests:** Atomic/partial failure behavior, array-property clearing, one refresh cycle, no `undefined` YAML key, and external-edit reconciliation. Prefer extending current mutation tests.

### 4.4 Field/schema plumbing for `sortOrder` and points

- **Legacy commits:** `273cc8f6`; `1f347258`; `3c89eb2b`; `5f47b15a`.
- **Legacy files:** `src/types.ts`; `src/services/FieldMapper.ts`; defaults, API controllers, template/Tasks plugin parsers, property visibility, ICS note service.
- **Likely current files:** `src/core/fieldMapping.ts`; `src/core/defaultFieldMapping.ts`; `src/bases/PropertyMappingService.ts`; user-field stack; API types/controllers.
- **Disposition:** **Split.** Manual order schema is upstream and must remain string-ranked. Story points should use current user-field plumbing unless explicitly approved as a core field. Drop unrelated one-line boilerplate copied across old parsers.
- **Difficulty / risks:** **Medium-high.** API compatibility and settings migration are the main concerns.
- **Tests:** Field round trips across YAML, API, modal, Bases, templates, and settings migration for any new property.

### 4.5 Localization and settings styling

- **Legacy commits:** `3e7d8b22`; `749baaf6`; `9e539ac3`; `d3e285eb`; `3a3a0ea6`; `ace89577`.
- **Legacy files:** `src/i18n/resources/{en,de,es,fr,ja,ru,zh}.ts`; `styles/settings-view.css`.
- **Likely current files:** current locale/resource files and settings components/styles.
- **Disposition:** **Redesign.** Add English keys with new feature slices and follow the current translation workflow. Do not copy machine-like legacy translations or large CSS blocks tied to removed markup.
- **Difficulty / risks:** **Medium.** Current main supports additional locales and reorganized keys.
- **Tests:** Translation key/type completeness, fallback behavior, action labels, and settings DOM class tests.

---

## 5. Changes upstream has since implemented independently

These items are not absent from current `main`; they are recorded to prevent duplicate ports.

### 5.1 Manual ordering and group-aware drag/drop

- **Legacy commits/files:** The numeric `sortOrder`/drag series from `273cc8f6` through `dc150503`, mainly `TaskListView`, `DragDropHandler`, `TaskService`, and `FilterService`.
- **Current implementation:** `src/bases/sortOrderUtils.ts`, `manualOrderState.ts`, `taskListDragGeometry.ts`, `taskListDropPlanning.ts`, `TaskListView.ts`, and Kanban drag utilities. Relevant upstream history includes `9fed004f`, `26712c4f`, `1861391e`, `a386be48`, and `dae38e32`.
- **Decision:** **Keep upstream.** Only assess selected-multi-drag as a separately scoped enhancement.
- **Tests already present:** `tests/unit/utils/sortOrderUtils.test.ts`, manual-order state, task-list drop/geometry, Kanban manual-order fast path, and task-list drag controls. Add only missing selected-block scenarios.

### 5.2 Batch selection and batch context actions

- **Legacy commits/files:** `61bc3ac9`, `78e4a4b8`, `4fb72fa4`; old task-list/card files.
- **Current implementation:** `TaskSelectionService`, `src/bases/basesSelectionUi.ts`, `src/components/BatchContextMenu.ts`, and Bases task-list/kanban integration. Upstream history includes `c284ed6b`, `39dbe980`, `19b3aca5`, and `5dd09aa9`.
- **Decision:** **Keep upstream; extend for keyboard focus/action targeting.**
- **Tests already present:** Bases selection UI and task selection service tests; add focused-fallback semantics.

### 5.3 Parent-note project defaults and project quick actions

- **Legacy commits/files:** `c9a4f5a0`, `5b8b1cbc`, `8294574c`, `7a0e7eb2`.
- **Current implementation:** `taskCreationPrepopulation.ts`, task creation defaults, instant conversion support, project selectors, and quick actions. Upstream commits include `77745914`, `47f99ea2`, `afce4abb`, `d1af0a03`, and `cac4f5e1`.
- **Decision:** **Keep upstream and route Jira/keyboard operations through it.**
- **Tests already present:** Parent-note/default project, conversion, project assignment, project inheritance, and quick-action issue regressions.

### 5.4 Ctrl/Cmd+Enter task modal save

- **Legacy commit/files:** `f0ba6049`; `src/modals/TaskEditModal.ts`.
- **Current implementation:** Explicit handlers in current `TaskCreationModal.ts` and `TaskEditModal.ts`.
- **Decision:** **Drop legacy change.**
- **Tests:** Retain/add a small platform-modifier regression test only if not already covered.

### 5.5 Creation prepopulation and parsed task data

- **Legacy commit/files:** `bf0e2338`, `63fff798`; old task modal/parser files.
- **Current implementation:** `taskCreationPrepopulation.ts`, `taskCreationData.ts`, `taskCreationFormState.ts`, and `buildTaskCreationDataFromParsed.ts`.
- **Decision:** **Keep upstream.**
- **Tests:** Current task creation, NLP, and API NLP-task-data suites provide the appropriate home.

### 5.6 Correct property writes and refresh lifecycle

- **Legacy commit/files:** `0e4bd5a5`, `01a5dc54`, `a9ac1d0b`, `ab16f202`; old `TaskService`, `MinimalNativeCache`, and refresh helpers.
- **Current implementation:** v5 mutation/update services and Bases refresh lifecycle replace the old cache architecture.
- **Decision:** **Keep upstream architecture; port no cache code.**
- **Tests:** Extend current task property/mutation and Bases update-listener tests when new Jira or keyboard batch operations are added.

### 5.7 Configurable/custom fields as overlap with story points

- **Legacy commit/files:** story-points series from `1f347258` through `96c80e6e`.
- **Current implementation:** v5 user fields, user-field modal controls, settings cards, filtering/sorting, Bases property mapping, and configurable NLP triggers cover much of the generic requirement.
- **Decision:** **Do not add a core `points` field until a short product spike demonstrates which story-points behaviors user fields cannot provide.**
- **Tests:** Prototype using a numeric user field and document gaps in defaulting, quick assignment, `^N` parsing, display, and sorting.

---

## Proposed porting slices and acceptance gates

### Slice A: Jira transformation core

Add typed external adapter, validated settings schema, pure mapping functions, defaults, and unit tests. No settings UI or command until mapping tests cover malformed and partial Jira data.

### Slice B: Jira import workflow

Register the translated command, fetch through the adapter, reuse current task creation/default-project/title sanitation, add backlink behavior, and add integration tests.

### Slice C: Jira mapping settings

Add preview/raw JSON UI, reset/migration behavior, escaping, and persistence tests. Ensure sample data is never persisted or logged.

### Slice D: Keyboard focus/navigation

Implement a view-scoped focus controller with no mutations. Ship arrow navigation, visible focus, rerender restoration, accessibility, and lifecycle tests first.

### Slice E: Keyboard action routing

Create semantic actions and the selected-or-focused resolver, then connect current action/modal/batch primitives. Add mutating actions incrementally, with delete last.

### Slice F: Configurable shortcuts

Add normalized bindings, settings UI, conflicts, migration, localization, and cross-platform tests after action IDs are stable.

### Slice G: Remaining deltas

Evaluate selected-task block dragging and story-points-via-user-field independently. Each requires a separate implementation plan and should not be bundled with Jira or keyboard navigation.

For every implementation slice, run the repository-required checks: `npm run typecheck`, relevant targeted tests followed by `npm test -- --runInBand`, `npm run lint`, and `npm run build`.
