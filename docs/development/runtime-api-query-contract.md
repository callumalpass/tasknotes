# Runtime API Query Contract

This document defines the ideal end-state for TaskNotes runtime query APIs used by companion plugins such as TaskNotes Workflows.

## Context

TaskNotes now exposes an in-process JavaScript runtime API for companion plugins. Recent runtime API work added namespaced task, query, catalog, event, lifecycle, and extension surfaces.

That direction is correct. The remaining risk is that the current query contract exposes `FilterQuery` directly. `FilterQuery` is powerful, but it was shaped for TaskNotes UI state: every node has an `id`, it carries view grouping fields, and it uses UI-oriented operator names. Companion plugins need a stable task-selection contract, not a leak of current view/filter internals.

The ideal end-state is:

- TaskNotes core owns task query semantics.
- Companion plugins call TaskNotes for task selection instead of reimplementing filters.
- Workflow engines remain orchestration layers, not query engines.
- The public query DTO is stable, serializable, validation-friendly, and independent of current UI state.
- Bases-compatible syntax can be imported or compiled later, but the runtime API has its own canonical structured model.

## Goals

- Provide one public task-selection query format for runtime API, HTTP API, MCP, CLI, and companion plugins.
- Keep task query semantics consistent with TaskNotes views where appropriate.
- Make query validation and dry-run/explain output deterministic.
- Support user-defined fields, computed task fields, file fields, date comparisons, sorting, limits, and grouping without exposing UI-only state.
- Preserve a clear boundary between task selection and task mutation.
- Keep triggers cheap: workflow/event triggers may filter event payloads, but vault-wide selection belongs in explicit query calls.

## Non-Goals

- Do not expose arbitrary JavaScript, Dataview, or unrestricted Bases formulas as the runtime query contract.
- Do not make the runtime API depend on Obsidian Bases as the query evaluator.
- Do not require companion plugins to know TaskNotes frontmatter mapping details.
- Do not make every workflow step a hidden query step.
- Do not treat the current `FilterQuery` shape as the long-term public contract unless it is intentionally cleaned up first.

## Current State

Current runtime APIs include:

- `api.tasks.list(query?: FilterQuery): Promise<TaskInfo[]>`
- `api.query.tasks(query?: FilterQuery): Promise<TaskNotesRuntimeTaskQueryResult>`
- `api.query.filterOptions(): Promise<FilterOptions>`
- `api.catalog.filterProperties(): TaskNotesRuntimeFilterPropertyDefinition[]`
- `api.catalog.filterOperators(): TaskNotesRuntimeFilterOperatorDefinition[]`

Current strengths:

- Query execution delegates to `FilterService`.
- Filter evaluation already handles nested groups, user fields, project links, computed dependency fields, and completion state.
- Catalog metadata gives companion-plugin editors a way to avoid hardcoded status, priority, field, and operator lists.
- Mutation APIs route through TaskNotes services and include mutation context for debuggability.

Current public-contract concerns:

- `FilterCondition.id` and `FilterGroup.id` are UI state, not query semantics.
- `FilterQuery` mixes selection with view grouping state.
- `FilterQuery` has no first-class `limit`, `offset`, or paging contract.
- `tasks.list(query?)` and `query.tasks(query?)` overlap without a sharply documented difference.
- Query result counts do not distinguish total, matched-before-limit, and returned-after-limit.
- Operators are UI phrase IDs such as `is-on-or-before`; that may be acceptable, but should be part of an intentional stable vocabulary.
- There is no `normalize`, `validate`, or `explain` API for companion plugins to test a query before running an automation.

## Proposed Public Query DTO

Introduce a stable public query shape, separate from internal `FilterQuery`.

```ts
export interface TaskNotesRuntimeTaskQuery {
	where?: TaskNotesRuntimePredicate;
	sort?: TaskNotesRuntimeSort[];
	limit?: number;
	offset?: number;
	group?: TaskNotesRuntimeGroup[];
	scope?: TaskNotesRuntimeQueryScope;
}

export type TaskNotesRuntimePredicate =
	| { all: TaskNotesRuntimePredicate[] }
	| { any: TaskNotesRuntimePredicate[] }
	| { not: TaskNotesRuntimePredicate }
	| TaskNotesRuntimeCondition;

export interface TaskNotesRuntimeCondition {
	field: string;
	op: TaskNotesRuntimeOperator;
	value?: TaskNotesRuntimeValue;
}

export type TaskNotesRuntimeValue =
	| string
	| number
	| boolean
	| null
	| TaskNotesRuntimeValue[]
	| { fn: "today" | "now" }
	| { fn: "date"; value: string }
	| { fn: "dateAdd"; value: TaskNotesRuntimeValue; amount: number; unit: "day" | "week" | "month" };

export interface TaskNotesRuntimeSort {
	field: string;
	direction?: "asc" | "desc";
}

export interface TaskNotesRuntimeGroup {
	field: string;
}

export interface TaskNotesRuntimeQueryScope {
	includeArchived?: boolean;
	folders?: string[];
	excludeFolders?: string[];
}
```

The query engine should normalize this DTO into the internal representation used by `FilterService`.

## Field Identity

Runtime query fields should be stable semantic IDs, not raw frontmatter keys.

Recommended canonical namespaces:

- `task.title`
- `task.status`
- `task.priority`
- `task.due`
- `task.scheduled`
- `task.completedDate`
- `task.archived`
- `task.tags`
- `task.contexts`
- `task.projects`
- `task.recurrence`
- `task.timeEstimate`
- `task.totalTrackedTime`
- `task.hasSubtasks`
- `task.isBlocked`
- `task.isBlocking`
- `task.blockedBy`
- `file.path`
- `file.name`
- `file.folder`
- `file.tags`
- `file.ctime`
- `file.mtime`
- `user.<id-or-key>`

TaskNotes can support aliases for compatibility and authoring ergonomics:

- Current `FilterProperty` IDs such as `status`, `due`, `dependencies.isBlocked`.
- Bases-like aliases such as `note.status` and `note.due`.

Aliases should compile into canonical field IDs before validation or execution. Run logs and explain output should display the normalized canonical query.

## Operators

Use a compact canonical operator vocabulary while accepting legacy aliases.

Recommended canonical operators:

- `eq`
- `ne`
- `contains`
- `notContains`
- `in`
- `notIn`
- `exists`
- `missing`
- `lt`
- `lte`
- `gt`
- `gte`
- `isTrue`
- `isFalse`

Compatibility aliases may map from current UI operator IDs:

- `is` -> `eq`
- `is-not` -> `ne`
- `does-not-contain` -> `notContains`
- `is-before` -> `lt`
- `is-on-or-before` -> `lte`
- `is-after` -> `gt`
- `is-on-or-after` -> `gte`
- `is-empty` -> `missing`
- `is-not-empty` -> `exists`
- `is-checked` -> `isTrue`
- `is-not-checked` -> `isFalse`

The catalog should expose both:

- canonical operator IDs for API clients
- display labels for UI clients
- accepted aliases for migration and authoring
- operator compatibility by field value type

## Query Result

Replace or augment the current result with explicit count semantics.

```ts
export interface TaskNotesRuntimeTaskQueryResult {
	tasks: TaskInfo[];
	total: number;      // total tasks in scope before where
	matched: number;    // tasks matching where before offset/limit
	returned: number;   // tasks returned after offset/limit
	groups?: TaskNotesRuntimeQueryGroup[];
	query: TaskNotesRuntimeNormalizedTaskQuery;
	warnings?: TaskNotesRuntimeQueryWarning[];
}

export interface TaskNotesRuntimeQueryGroup {
	key: string;
	label: string;
	taskPaths: string[];
}
```

If grouping is not requested, omit `groups` or return a single `all` group. Do not make grouping mandatory for simple selection.

## Validation, Normalization, And Explain

Add explicit query support helpers:

```ts
export interface TaskNotesRuntimeQueryApi {
	tasks(query?: TaskNotesRuntimeTaskQuery): Promise<TaskNotesRuntimeTaskQueryResult>;
	validate(query: unknown): TaskNotesRuntimeQueryValidationResult;
	normalize(query: unknown): TaskNotesRuntimeNormalizedTaskQuery;
	explain(query: unknown): Promise<TaskNotesRuntimeQueryExplainResult>;
	filterOptions(): Promise<FilterOptions>;
}
```

`validate` should report unsupported fields, unsupported operators, wrong value types, and invalid helper functions without executing the query.

`normalize` should:

- expand aliases
- fill defaults
- strip UI-only fields
- canonicalize operators
- resolve field IDs to catalog entries

`explain` should return enough data for dry runs and workflow debugging:

- normalized query
- candidate count
- matched count
- returned count
- applied sort
- applied limit/offset
- optimization notes where useful
- validation warnings

## Relationship To Existing `FilterQuery`

Keep `FilterQuery` as an internal or legacy DTO unless it is deliberately promoted.

Recommended migration path:

1. Add `TaskNotesRuntimeTaskQuery` alongside existing `FilterQuery`.
2. Add an adapter from runtime query DTO to internal `FilterQuery`.
3. Keep `api.tasks.list(query?: FilterQuery)` working for compatibility during the transition.
4. Prefer `api.query.tasks(query?: TaskNotesRuntimeTaskQuery)` in docs and companion-plugin examples.
5. Optionally allow `api.query.tasks()` to accept legacy `FilterQuery` during a deprecation window, but normalize it immediately.
6. Move query contract types toward a standalone runtime API package when the shape stabilizes.

The adapter should be the only place where public query fields map to internal filter properties, field mapping, user fields, and current `FilterService` operator names.

## Catalog Requirements

The runtime catalog should support editor generation and query validation.

Each queryable field should include:

- canonical field ID
- display label
- category
- value type
- source: `model`, `computed`, `file`, or `user`
- writable flag
- queryable flag
- sortable flag
- groupable flag
- supported canonical operators
- accepted aliases
- frontmatter key, where applicable
- deprecation metadata, where applicable

Each operator should include:

- canonical ID
- display label
- value required flag
- accepted value types
- accepted aliases

## Workflows Integration

TaskNotes Workflows should use TaskNotes runtime query APIs for task selection.

Workflow usage should look like this:

```yaml
steps:
  - id: due-now
    type: task.query
    input:
      query:
        where:
          all:
            - field: task.status
              op: notIn
              value: [done, cancelled]
            - field: task.due
              op: lte
              value:
                fn: today
        sort:
          - field: task.due
            direction: asc
        limit: 50

  - id: mark-high
    type: task.patch
    forEach: "{{steps.due-now.tasks}}"
    input:
      task: "{{item.path}}"
      patch:
        priority: high
```

Workflow-level `conditions` and step-level `if` may use a similar predicate model, but they evaluate against workflow context, not the TaskNotes task index. They should not call `api.query.tasks()` implicitly.

Trigger filters should stay event-local. A trigger can inspect `event`, `before`, `after`, `changes`, `source`, and `path`, but vault-wide queries should run as explicit steps after the workflow starts.

## Bases Compatibility

Bases is the right mental-model inspiration, not the runtime dependency.

TaskNotes should eventually be able to:

- compile a subset of Bases filter expressions into `TaskNotesRuntimeTaskQuery`
- import filters from a `.base` file where the mapping is unambiguous
- expose familiar aliases such as `note.status`, `note.due`, and `file.path`

TaskNotes should not:

- depend on Obsidian Bases as the query evaluator
- claim full Bases formula compatibility unless it actually matches edge cases
- expose arbitrary formula strings as the canonical runtime query contract

If string syntax is added, it should compile into the structured query DTO. The structured form remains canonical.

## API Naming Decisions

Recommended naming:

- `api.query.tasks(query)` is the canonical selection API.
- `api.tasks.list()` is a simple unfiltered list or a compatibility alias.
- `api.stats.tasks(query)` accepts the same canonical query.
- `api.catalog.queryFields()` may be clearer than overloading `catalog.filterProperties()`, but either is acceptable if documented.

Avoid making companion plugins choose between multiple task-selection APIs with subtly different semantics.

## Testing Requirements

Add unit coverage for:

- normalization from canonical query DTO to internal `FilterQuery`
- legacy `FilterQuery` compatibility, if supported
- field aliases: `task.status`, `note.status`, `status`
- operator aliases: `lte`, `is-on-or-before`, etc.
- user fields by ID and key
- computed fields: `task.hasSubtasks`, `task.isBlocked`, `task.isBlocking`, `task.status.isCompleted`
- date helpers: `today`, `now`, and simple date offsets
- limit/offset counts
- invalid fields and invalid operator/value combinations
- `explain` output
- `api.stats.tasks(query)` matching `api.query.tasks(query)` selection semantics

Add integration/smoke coverage for:

- a companion-plugin style query through `api.query.tasks`
- a workflow-style query selecting overdue incomplete tasks
- a query using user fields from settings
- a query involving dependency/computed fields

## Implementation Prompt

Use this prompt for an implementation pass:

```text
We are hardening the TaskNotes JavaScript runtime API for companion plugins. Inspect the current runtime API in src/api/runtime-api.ts and src/api/TaskNotesAPI.ts, the current FilterQuery types in src/types.ts, and FilterService/filterPredicateEvaluation. Implement a stable public task-selection query DTO that does not leak UI-only FilterQuery state. Keep TaskNotes core as the owner of task query semantics.

Target outcome:
- Add TaskNotesRuntimeTaskQuery, TaskNotesRuntimePredicate, canonical field/operator types, normalization, validation, and explain support.
- Keep existing FilterQuery working internally and through a compatibility path where practical.
- Make api.query.tasks(query) the canonical public selection API.
- Keep api.tasks.list() as simple list/compatibility, but document the distinction.
- Expose catalog metadata sufficient for companion-plugin query editors.
- Preserve current TaskNotes filtering behavior by translating the public query DTO into the existing FilterService pipeline.
- Do not introduce arbitrary JavaScript, Dataview, or a dependency on Obsidian Bases as the evaluator.
- Update docs/javascript-api.md and focused unit tests.

Important boundaries:
- Task mutations must continue through TaskService-backed runtime APIs.
- Workflow/event triggers should only filter event payloads; vault-wide task selection belongs in explicit query calls.
- The normalized query should be visible in query result or explain output so dry runs can be debugged.
```

