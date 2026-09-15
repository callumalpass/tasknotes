## Legacy feature branch

The legacy implementation is on:

* `task-view-keyboard-and-project-mgmt`

It was developed against TaskNotes 3.2.x and must be adapted to the current TaskNotes 4.x architecture. Treat the branch as a behavioral reference and source of tests, not as code that must be merged or copied unchanged.

## Features to port

### 1. Keyboard-first task-list interaction

The task list supports persistent keyboard focus, visible focused and selected states, single- and multi-task selection, and commands for creating, opening, editing, filtering, scheduling, changing due dates, changing priority, changing status, assigning recurrence, assigning tags, assigning contexts, assigning projects, and deleting tasks.

Keyboard behavior remains active and predictable when context menus, filters, and modals are opened or closed. Commands that operate on tasks should consistently target either the current selection or the focused task.

### 2. Configurable keyboard shortcuts

Task-list shortcuts are configurable in settings. The implementation includes shortcut parsing, defaults, persistence, localized settings labels, and a dedicated shortcut-editing UI.

Port this feature using the current settings and input architecture rather than preserving the legacy implementation structure.

### 3. Jira integration

Users can import Jira issues as TaskNotes tasks through the `obsidian-jira-issue` integration.

The Jira feature includes:

* Configurable Jira-to-TaskNotes field mappings
* Mapping-value previews
* Raw Jira issue JSON inspection
* Sensible mapping defaults
* Jira issue backlinks
* Sanitized imported note titles
* Current-note project assignment
* Localized settings and validation text

Review whether TaskNotes 4.x now has import, templating, external-integration, or credential abstractions that should replace the legacy design.

### 4. Manual ordering and drag-and-drop

Tasks support persistent manual ordering through a `sortOrder` or equivalent ranking field.

Drag-and-drop supports:

* Reordering within a group
* Moving tasks between groups
* Dropping at the end of a list
* Moving all selected tasks together
* Moving tasks across multiple groups
* Ascending and descending task-list order
* Batched persistence and efficient list refresh

Use the current TaskNotes ranking, cache, grouping, and rendering systems. Do not assume the legacy `sortOrder` implementation remains appropriate.

### 5. Project-aware task workflows

The current note can be used as the default project for task creation and Jira imports.

Users can assign projects through task-list commands and context menus. Project subtask views should honor the same relevant filters as other task-list views.

Review current TaskNotes project semantics before porting legacy modal behavior.

### 6. Story-point estimation

Tasks support a story-points estimate, including:

* Task schema/frontmatter storage
* A configurable default
* Task-creation support
* Natural-language parsing using syntax such as `^3`
* A story-points editing modal
* Context-menu assignment
* Task-list display and sorting

### 7. Supporting workflow and correctness improvements

Preserve the intended behavior of the following improvements where still relevant:

* Pre-populating task-creation natural-language input
* Populating task titles and other values from NLP parsing
* Keeping context menus within the viewport
* Filtering already-applied tags and contexts from selection dialogs
* Ctrl+Enter to save task editing
* Shift+Enter to open task notes
* Correct frontmatter handling for optional and array properties
* Correct cache invalidation and list refresh after batch changes
* Complete localization for all new user-visible text

## Porting method

Port one functional slice at a time.

For each slice:

1. Inspect the legacy commits and final legacy implementation.
2. Locate the corresponding TaskNotes 4.x architecture.
3. Identify functionality now provided by upstream.
4. Write a short implementation plan.
5. Port the behavior using current abstractions.
6. Add or adapt tests.
7. Run typecheck, relevant tests, lint, and build.
8. Review the resulting diff before committing.

Do not merge the full legacy branch into current main. Cherry-pick only small, isolated commits when their implementation remains compatible with the current architecture.
