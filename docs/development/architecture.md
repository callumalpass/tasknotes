# Architecture

This page describes the project structure and key systems in TaskNotes. For contributor onboarding, see [Contributing](../contributing.md).

## Project Structure

```
tasknotes/
  src/                  TypeScript source code
    bases/              Bases view system (rendering, toolbar, property mapping)
    bulk/               Bulk tasking engines (generate, convert, edit)
    identity/           Device identity and person/group note discovery
    modals/             Modal dialogs (task creation, edit, bulk, reminders)
    notifications/      Background monitoring, toast, bell badge
    services/           Core business logic (task CRUD, field mapping)
    settings/           Settings UI and defaults
    ui/                 Reusable UI components (PropertyPicker, pickers)
    utils/              Shared utilities
  styles/               CSS source files (concatenated at build time)
  docs/                 Documentation (this site)
  tests/                Jest unit and integration tests
  e2e/                  Playwright end-to-end tests
  main.js               Build output (do not edit directly)
  styles.css            CSS build output (do not edit directly)
  manifest.json         Obsidian plugin manifest
  package.json          Dependencies and scripts
```

## Key Files

| File | Purpose |
|------|---------|
| `src/main.ts` | Plugin entry point, command registration, lifecycle |
| `src/services/TaskService.ts` | Task creation, update, deletion |
| `src/services/FieldMapper.ts` | Translates between internal and user-configured property names |
| `src/bases/BasesViewBase.ts` | Base class for all TaskNotes Bases view types |
| `esbuild.config.mjs` | Build configuration |
| `build-css.mjs` | CSS concatenation script |

## Key Systems

### Bases Integration

TaskNotes extends Obsidian's [Bases](https://help.obsidian.md/bases) with custom view types (Task List, Kanban, Calendar, Upcoming, Agenda). Each view type extends `BasesViewBase`, which handles data loading, filtering, and rendering. The `BasesToolbarInjector` adds TaskNotes buttons to native Bases views.

### Task Service

`TaskService` handles creating, reading, updating, and deleting task files. `FieldMapper` translates between internal field names (like `due`) and user-configured property names (like `deadline`). Per-task overrides are resolved via `fieldOverrideUtils`.

### Notification System

`BasesQueryWatcher` monitors `.base` files with `notify: true`, evaluates their queries in the background, and triggers the toast notification and bell badge when items match. `VaultWideNotificationService` aggregates notifications from views and upstream reminders.

### Bulk Tasking

`BulkOperationEngine` routes to specialized engines: `BulkTaskEngine` (generate), `BulkConvertEngine` (convert in-place), `BulkEditEngine` (modify properties), and `BulkUpdateEngine` (reschedule, archive, complete, delete).

For the user-facing explanation of Generate vs Convert, see [When to Use Generate vs Convert](../features/bulk-tasking.md#when-to-use-generate-vs-convert).

### Identity System

`DeviceIdentityManager` assigns each device a UUID. `UserRegistry` maps devices to person notes. `PersonNoteService` discovers person notes and `GroupRegistry` discovers groups with recursive member resolution.
