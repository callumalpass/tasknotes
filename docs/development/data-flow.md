# TaskNotes Data Flow

This document records the intended data-flow model for the refactor.

## Source of Truth

Task data is stored in Markdown files with frontmatter inside the user vault.

Primary source of truth:

- markdown file content
- Obsidian metadata cache for indexed read access

TaskNotes should avoid introducing a competing internal database for core task state.

## Read Path

1. Vault files change.
2. Obsidian metadata cache updates.
3. `TaskManager` and related adapters read task state from metadata cache.
4. Domain services and views consume normalized `TaskInfo` representations.

## Write Path

1. A view, modal, command, or API endpoint requests a task mutation.
2. The request flows through `TaskService` or a dedicated mutation collaborator.
3. Frontmatter/body changes are written to the markdown file.
4. Obsidian metadata cache emits update events.
5. Event listeners invalidate caches and refresh views.

## Cache Principles

Current intent:

- metadata cache remains the primary read accelerator
- plugin-local caches should be derived and invalidatable
- derived caches must never become a second source of truth

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

## Date and Recurrence Flow

Date handling is a historically sensitive area.

Refactor rule:

- parsing and coercion should happen at the boundary
- internal logic should use explicit date semantics
- recurrence expansion should remain centralized rather than duplicated in views

## Operational Principle

When debugging a behavior problem, the first question should be:

"Is this a source-data issue, an adapter issue, a domain-logic issue, or a view-refresh issue?"

The architecture should make that answer obvious.
