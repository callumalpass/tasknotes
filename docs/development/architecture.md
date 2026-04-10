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
- settings load/save
- workspace command entry points
- integration registration
- delegation into bootstrap and services

Should not own:

- detailed business logic
- view rendering logic
- low-level task mutation logic

### Bootstrap

`src/bootstrap/`

Owns:

- service construction
- startup sequencing
- layout-ready initialization
- lazy initialization of optional/heavy services

Should not own:

- business rules
- task parsing
- long-lived presentation behavior

### Domain Services

`src/services/`

Own:

- task creation and mutation
- filtering, grouping, sorting
- recurrence and time tracking logic
- external provider coordination

Should not own:

- direct DOM rendering
- plugin startup sequencing

### Data Access and Adapters

`src/utils/TaskManager.ts`, `src/bases/`, future adapters

Own:

- metadata-cache-backed task reads
- conversion between Bases data and TaskNotes representations
- frontmatter/property coercion at integration boundaries

Should not own:

- view-specific rendering policy
- unrelated UI decisions

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

## Important Boundaries

### Task Mutations

Task creation, update, recurrence transitions, archive toggles, and relationship writes should flow through `TaskService` and its collaborators, not ad hoc UI code.

### Filtering and Grouping

Query planning, predicate evaluation, sorting, grouping, and label formatting should be separate concerns even if they remain behind the same facade during migration.

### Bases Integration

Treat Bases as an integration boundary. TaskNotes should normalize the subset of Bases APIs it depends on into local adapter types rather than spreading `any`-based access across views.

### Logging and User Notices

Console logging, diagnostics, and user-facing notices should eventually route through a small shared policy layer rather than each module handling those concerns independently.

## Migration Direction

The refactor strategy is incremental:

1. move construction and startup orchestration out of `src/main.ts`
2. split large service modules behind stable facades
3. tighten types at integration edges
4. split large UI modules after domain seams are clearer

The goal is not a rewrite. The goal is to reduce coupling while preserving behavior.
