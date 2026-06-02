# TaskNotes JavaScript Runtime API

TaskNotes exposes an in-process runtime API on the loaded Obsidian plugin instance:

```javascript
const tasknotes = app.plugins.plugins.tasknotes;
const api = tasknotes?.api;
```

This API is for Obsidian companion plugins and in-vault scripting tools such as Templater, QuickAdd, and MetaBind. It runs inside Obsidian and uses the same TaskNotes services, settings, cache, and vault permissions as the plugin UI.

This is separate from the [HTTP API](HTTP_API.md). The runtime API does not start a server, does not use bearer-token authentication, and is only available inside the running Obsidian app.

For user-facing extensions built on this API, see [Companion Plugins](companion-plugins.md). For a concrete automation companion plugin, see [TaskNotes Workflows](companion-plugins/tasknotes-workflows.md).

The TypeScript contract lives in `src/api/runtime-api.ts`. It is intentionally small and type-focused so it can later become a standalone `@tasknotes/runtime-api` package for companion plugins.

## Version and Capabilities

Check the API version and capabilities before using methods that may not exist in older TaskNotes versions:

```javascript
const tasknotes = app.plugins.plugins.tasknotes;
const api = tasknotes?.api;

if (!api || api.apiVersion !== 1 || !api.hasCapability("tasks.write")) {
	throw new Error("This workflow requires TaskNotes runtime API v1 task writes");
}
```

Current capabilities:

- `model.read`
- `model.validate`
- `catalog.read`
- `extensions.read`
- `extensions.register`
- `tasks.read`
- `tasks.write`
- `tasks.delete`
- `tasks.move`
- `tasks.events`
- `relationships.read`
- `events.list`
- `time.read`
- `time.write`
- `time.summary`
- `pomodoro.read`
- `pomodoro.write`
- `pomodoro.events`
- `recurring.write`
- `recurring.materialize`
- `recurring.events`
- `settings.snapshot`
- `nlp.parse`
- `query.tasks`
- `query.validate`
- `query.explain`
- `query.filter-options`
- `stats.tasks`
- `system.health`
- `lifecycle.events`
- `errors.typed`

## Namespaces

Prefer the namespaced API for new code:

```javascript
await api.tasks.update("Tasks/example.md", { status: "active" });
const subtasks = await api.relationships.subtasks("Tasks/example.md");
await api.time.start("Tasks/example.md", { description: "Deep work" });
await api.pomodoro.start({ taskPath: "Tasks/example.md", duration: 25 });
```

The older flat methods, such as `api.getTask(path)` and `api.parseNaturalLanguage(text)`, remain available as compatibility aliases.

## Extension Registry

Companion plugins can publish their own runtime API namespace through `api.extensions`. This is the preferred way to extend TaskNotes without adding arbitrary properties to the core API object.

```javascript
const tasknotes = this.app.plugins.getPlugin("tasknotes");
const api = tasknotes?.api;

if (!api?.hasCapability("extensions.register")) {
	return;
}

const handle = api.extensions.register({
	id: this.manifest.id,
	namespace: "tasknotes-workflows",
	displayName: "TaskNotes Workflows",
	version: this.manifest.version,
	capabilities: ["tasknotes-workflows.run", "tasknotes-workflows.events"],
	api: {
		runWorkflow: async (workflowId, input) => {
			// companion plugin implementation
		},
	},
});

this.register(() => handle.unregister());
```

Other plugins can discover and consume extension namespaces:

```javascript
const workflows = api.extensions.get("tasknotes-workflows");

if (api.hasCapability("tasknotes-workflows.run")) {
	await workflows.runWorkflow("start-timer-on-active", { taskPath: "Tasks/example.md" });
}
```

Extension namespaces are normalized to lowercase and may use letters, numbers, dots, underscores, or dashes. Capability names are also normalized to lowercase. Prefix extension capabilities with the extension namespace to avoid collisions.

## Companion Plugin Access

Companion plugins can read the TaskNotes plugin instance from Obsidian's plugin registry:

```javascript
const tasknotes = this.app.plugins.getPlugin("tasknotes");
const api = tasknotes?.api;

if (!api?.hasCapability("tasks.events")) {
	return;
}

this.registerEvent(
	api.events.on("task.status.changed", (event) => {
		console.log(event.taskPath, event.changes.status);
	})
);
```

If TaskNotes is disabled or has not loaded yet, `api` will be unavailable. Companion plugins should handle that case and retry after plugin load if needed.

## TypeScript

Use the exported runtime contract for type safety:

```typescript
import type { TaskNotesRuntimeApiV1 } from "tasknotes/src/api/runtime-api";

type TaskNotesPluginInstance = {
	api?: TaskNotesRuntimeApiV1;
};

const tasknotes = app.plugins.getPlugin("tasknotes") as TaskNotesPluginInstance | null;
const api = tasknotes?.api;

if (api?.apiVersion === 1 && api.hasCapability("tasks.write")) {
	await api.tasks.setStatus("Tasks/example.md", "active");
}
```

TaskNotes is still loaded by Obsidian at runtime. The TypeScript contract only gives companion plugins compile-time checking and autocomplete.

## Model

The runtime API exposes a small model namespace backed by `@tasknotes/model`:

```javascript
const info = api.model.info();
const config = api.model.config();
const validation = api.model.validateTask(task);
```

| Method                           | Description                                                                                      |
| -------------------------------- | ------------------------------------------------------------------------------------------------ |
| `api.model.info()`               | Returns the model package name, TaskNotes spec version, and runtime API version.                 |
| `api.model.config()`             | Returns a resolved, Obsidian-free model configuration snapshot derived from TaskNotes settings.  |
| `api.model.validateTask(task)`   | Validates a partial or complete task against the shared model schema and TaskNotes status rules. |
| `api.model.validatePatch(patch)` | Validates a task patch before passing it to a runtime task mutation.                             |

## Catalog

Use `api.catalog` to build companion-plugin editors without hardcoding TaskNotes values:

```javascript
const statuses = api.catalog.statuses();
const writableFields = api.catalog.writableFields();
const operators = api.catalog.filterOperators();
```

| Method                             | Description                                                                                                       |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `api.catalog.statuses()`           | Returns configured TaskNotes status definitions.                                                                  |
| `api.catalog.priorities()`         | Returns configured TaskNotes priority definitions.                                                                |
| `api.catalog.userFields()`         | Returns configured user-defined field mappings.                                                                   |
| `api.catalog.fields()`             | Returns core, computed, and user field metadata with value type, writability, and frontmatter key when available. |
| `api.catalog.writableFields()`     | Returns only fields that runtime task mutations may write.                                                        |
| `api.catalog.filterProperties()`   | Returns canonical query fields, aliases, value types, and supported operators.                                    |
| `api.catalog.filterOperators()`    | Returns canonical query operators, labels, value requirements, and accepted aliases.                              |
| `api.catalog.relationships()`      | Returns relationship categories supported by `api.relationships`.                                                 |
| `api.catalog.dependencyRelTypes()` | Returns dependency relationship types accepted by `api.tasks.addDependency`.                                      |
| `api.catalog.events()`             | Returns the same runtime event catalogue as `api.events.list()`.                                                  |

## Tasks

All paths are vault-relative Markdown file paths.

| Method                                                                            | Description                                                                                                                     |
| --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `api.tasks.get(path)`                                                             | Returns a task by path, or `null` when no task is cached at that path.                                                          |
| `api.tasks.list(query?)`                                                          | Returns all tasks, or tasks matching a runtime task query. Prefer `api.query.tasks()` when count and grouping metadata matters. |
| `api.tasks.create(taskData, context?)`                                            | Creates a task using the normal TaskNotes creation service.                                                                     |
| `api.tasks.update(path, patch, context?)`                                         | Updates one or more task fields using the normal TaskNotes update service.                                                      |
| `api.tasks.delete(path, context?)`                                                | Deletes the task file through TaskNotes' delete service.                                                                        |
| `api.tasks.complete(path, options?, context?)`                                    | Marks a task complete.                                                                                                          |
| `api.tasks.uncomplete(path, options?, context?)`                                  | Moves a completed task back to a non-completed status.                                                                          |
| `api.tasks.setStatus(path, status, context?)`                                     | Sets task status.                                                                                                               |
| `api.tasks.setPriority(path, priority, context?)`                                 | Sets task priority.                                                                                                             |
| `api.tasks.setDue(path, date, context?)` / `clearDue(path, context?)`             | Sets or clears due date.                                                                                                        |
| `api.tasks.setScheduled(path, date, context?)` / `clearScheduled(path, context?)` | Sets or clears scheduled date.                                                                                                  |
| `api.tasks.archive(path, archived, context?)`                                     | Archives or unarchives a task, including archive-folder movement when configured.                                               |
| `api.tasks.move(path, targetFolder, context?)`                                    | Moves the task note and refuses to overwrite an existing file.                                                                  |
| `api.tasks.addTag/removeTag`                                                      | Mutates task tags.                                                                                                              |
| `api.tasks.addProject/removeProject`                                              | Mutates project links.                                                                                                          |
| `api.tasks.addContext/removeContext`                                              | Mutates contexts.                                                                                                               |
| `api.tasks.setReminders/addReminder/removeReminder`                               | Mutates reminders.                                                                                                              |
| `api.tasks.addDependency/removeDependency`                                        | Mutates blocking dependencies stored in `blockedBy`.                                                                            |

Example:

```javascript
const task = await api.tasks.create(
	{
		title: "Review automation design",
		status: "open",
		priority: "normal",
		scheduled: "2026-06-01",
		tags: ["tasknotes"],
	},
	{
		source: "my-companion-plugin",
		correlationId: crypto.randomUUID(),
		reason: "manual workflow command",
	}
);

await api.tasks.complete(task.path);
```

## Relationships

Relationship methods resolve TaskNotes' project-as-parent links and `blockedBy` dependencies into task records where possible.

| Method                                 | Description                                                                |
| -------------------------------------- | -------------------------------------------------------------------------- |
| `api.relationships.parents(path)`      | Returns parent tasks referenced from the task's projects.                  |
| `api.relationships.subtasks(path)`     | Returns tasks that reference this task as a project.                       |
| `api.relationships.dependencies(path)` | Returns `blockedBy` dependencies with resolved task data when available.   |
| `api.relationships.blocking(path)`     | Returns tasks that are blocked by this task.                               |
| `api.relationships.all(path)`          | Returns the task plus parents, subtasks, dependencies, and blocking tasks. |

Example:

```javascript
const relationships = await api.relationships.all("Tasks/example.md");

for (const subtask of relationships.subtasks) {
	await api.tasks.setPriority(subtask.path, relationships.task.priority);
}
```

## Time Tracking

| Method                                             | Description                                                          |
| -------------------------------------------------- | -------------------------------------------------------------------- |
| `api.time.start(path, options?, context?)`         | Starts time tracking and returns the updated task.                   |
| `api.time.stop(path, context?)`                    | Stops the active time entry and returns the updated task.            |
| `api.time.active()`                                | Returns active time entries with task, path, entry, and entry index. |
| `api.time.summary(options?)`                       | Returns aggregate time totals, top tasks, projects, and tags.        |
| `api.time.task(path)`                              | Returns one task's time summary and normalized time entries.         |
| `api.time.append(path, entry, context?)`           | Appends a time entry.                                                |
| `api.time.deleteEntry(path, entryIndex, context?)` | Deletes a time entry through TaskNotes' service.                     |

## Query, Stats, And System

The query, stats, and system namespaces expose HTTP/MCP-style support data without requiring companion plugins to reach into TaskNotes internals. Runtime queries use a stable DTO rather than TaskNotes' internal view state.

```javascript
const result = await api.query.tasks({
	where: {
		all: [
			{ field: "task.status", op: "eq", value: "active" },
			{ field: "task.due", op: "lte", value: { fn: "today" } },
		],
	},
	sort: [{ field: "task.due", direction: "asc" }],
	group: [{ field: "task.status" }],
	limit: 25,
	scope: {
		includeArchived: false,
		folders: ["Tasks"],
	},
});
```

Runtime query fields are canonical IDs such as `task.status`, `task.priority`, `task.due`, `task.projects`, `task.isBlocked`, `file.path`, and `user.<id-or-key>`. `api.catalog.filterProperties()` returns the complete queryable field catalog, including aliases such as `status` and `user:<id>`.

Canonical operators are `eq`, `ne`, `contains`, `notContains`, `in`, `notIn`, `exists`, `missing`, `lt`, `lte`, `gt`, `gte`, `isTrue`, and `isFalse`. Legacy operator aliases such as `is`, `is-not`, `is-on-or-before`, and `is-not-empty` are accepted and normalized.

`api.query.tasks()` returns explicit count semantics:

- `total`: tasks in scope before filtering
- `matched`: tasks matching `where` before `offset` and `limit`
- `returned`: tasks returned after `offset` and `limit`
- `tasks`: returned task records
- `groups`: optional group details with task paths
- `query`: the normalized canonical query
- `warnings`: non-fatal normalization notes

| Method                       | Description                                                                                        |
| ---------------------------- | -------------------------------------------------------------------------------------------------- |
| `api.query.tasks(query?)`    | Validates, normalizes, and executes a runtime task query.                                          |
| `api.query.validate(query)`  | Validates a query without executing it.                                                            |
| `api.query.normalize(query)` | Returns the canonical normalized query, or throws a typed `invalid_input` API error.               |
| `api.query.explain(query)`   | Returns validation, normalized query, count, grouping, and applied sort/limit details for dry run. |
| `api.query.filterOptions()`  | Returns available statuses, priorities, contexts, projects, tags, folders, and user properties.    |
| `api.stats.tasks(query?)`    | Returns task counts, status/priority counts, archive/completion counts, and time-tracking totals.  |
| `api.system.health()`        | Returns runtime status, API version, capabilities, vault identity, and task count.                 |

TaskNotes compiles this DTO into its internal filter engine. Companion plugins should treat the runtime DTO and the catalog metadata as the public query contract.

## Pomodoro

| Method                                          | Description                                   |
| ----------------------------------------------- | --------------------------------------------- |
| `api.pomodoro.status()`                         | Returns current Pomodoro state.               |
| `api.pomodoro.start(options?, context?)`        | Starts a Pomodoro session.                    |
| `api.pomodoro.stop(context?)`                   | Stops and resets the active Pomodoro session. |
| `api.pomodoro.pause(context?)`                  | Pauses the current session.                   |
| `api.pomodoro.resume(context?)`                 | Resumes a paused session.                     |
| `api.pomodoro.assignTask(pathOrNull, context?)` | Assigns or clears the current session task.   |
| `api.pomodoro.sessions(options?)`               | Returns Pomodoro session history.             |
| `api.pomodoro.stats(date?)`                     | Returns Pomodoro stats for a date or today.   |

## Recurring Tasks

| Method                                                        | Description                                          |
| ------------------------------------------------------------- | ---------------------------------------------------- |
| `api.recurring.toggleCompleteInstance(path, date?, context?)` | Toggles completion for a recurring task instance.    |
| `api.recurring.toggleSkippedInstance(path, date?, context?)`  | Toggles skipped state for a recurring task instance. |
| `api.recurring.materializeOccurrence(path, date, context?)`   | Creates or returns an occurrence note for a recurring task date. |

## Natural Language Parser

```javascript
const parsed = api.nlp.parse("Write draft friday 2pm #writing @desk");
```

`api.parseNaturalLanguage(text)` remains as a compatibility alias. Parsing does not create or modify task files.

See [NLP API](nlp-api.md) for HTTP endpoint details and parser behavior.

## Settings Snapshot

```javascript
const settings = api.settings.snapshot();
console.log(settings.defaultTaskStatus);
```

The returned object is a snapshot. Mutating it does not change TaskNotes settings. `api.getSettingsSnapshot()` remains available as a compatibility alias.

## Mutation Context

Mutating methods accept an optional context object:

```javascript
{
  source: "tasknotes-workflows",
  correlationId: "run-2026-06-01T09-00-00",
  reason: "status changed to active"
}
```

TaskNotes attaches this context to normalized events emitted during the mutation. Use it to make workflow runs debuggable, connect multiple API calls to one run, and prevent companion plugins from responding to their own writes.

## Events

Subscribe with `api.events.on(eventName, handler)` and unsubscribe with `api.events.off(ref)`. In an Obsidian plugin, pass the returned `EventRef` to `this.registerEvent(ref)`.

Use `api.events.list()` to discover the event catalogue for companion-plugin UIs:

```javascript
const events = api.events.list();
// [{ name: "task.status.changed", label: "Task status changed", category: "task", ... }]
```

Task events:

- `task.created`
- `task.updated`
- `task.deleted`
- `task.moved`
- `task.status.changed`
- `task.completed`
- `task.uncompleted`
- `task.archived`
- `task.unarchived`
- `task.scheduled.changed`
- `task.due.changed`
- `task.priority.changed`
- `task.tags.changed`
- `task.contexts.changed`
- `task.projects.changed`
- `task.reminders.changed`
- `task.dependencies.changed`
- `task.recurrence.changed`

Time, Pomodoro, and recurring events:

- `time.started`
- `time.stopped`
- `pomodoro.started`
- `pomodoro.completed`
- `pomodoro.interrupted`
- `recurring.instance.completed`
- `recurring.instance.skipped`

Specific events are emitted in addition to `task.updated`. For example, changing a task from `open` to `done` emits `task.updated`, `task.status.changed`, and `task.completed`.

Event payloads have this shape:

```javascript
{
  event: "task.status.changed",
  timestamp: "2026-06-01T09:00:00.000Z",
  taskPath: "Tasks/Review automation design.md",
  task: { /* current task */ },
  before: { /* task before change */ },
  after: { /* task after change */ },
  deletedTask: undefined,
  changes: {
    status: {
      before: "open",
      after: "done"
    }
  },
  data: undefined,
  context: {
    source: "tasknotes-workflows",
    correlationId: "run-2026-06-01T09-00-00",
    reason: "status changed to done"
  },
  source: "tasknotes-workflows",
  correlationId: "run-2026-06-01T09-00-00",
  reason: "status changed to done",
  rawEvent: "task-updated"
}
```

Events caused outside the runtime API may not include `context`, `source`, `correlationId`, or `reason`.

Example automation-style listener:

```javascript
const source = "my-workflow-plugin";

this.registerEvent(
	api.events.on("task.status.changed", async (event) => {
		if (event.source === source) {
			return;
		}

		if (event.after?.status !== "active") {
			return;
		}

		await api.time.start(event.after.path, undefined, {
			source,
			correlationId: event.correlationId ?? crypto.randomUUID(),
			reason: "status changed to active",
		});
	})
);
```

## Lifecycle

Use `api.lifecycle` to coordinate companion plugin startup, reload, and cache-sensitive UI state:

```javascript
await api.lifecycle.ready();

this.registerEvent(
	api.lifecycle.on("settings.changed", () => {
		refreshCompanionCatalogs();
	})
);
```

Lifecycle events:

- `ready`
- `layout.ready`
- `settings.changed`
- `cache.changed`
- `cache.rebuilt`
- `extension.registered`
- `extension.unregistered`
- `unloading`

`api.lifecycle.list()` returns labels, descriptions, and categories for these events.

## Error Handling

API methods throw `TaskNotesApiError` for invalid input or failed operations that the runtime API can classify. The error object includes:

- `name`: always `TaskNotesApiError`
- `code`: a stable machine-readable code
- `message`: a human-readable message for logs
- `status`: an HTTP-style status code for tools that mirror runtime calls over HTTP or MCP
- `details`: optional structured context such as the task path, extension namespace, or invalid status

Common examples:

- The task path is empty or invalid.
- No task exists at the requested path.
- A target move folder already contains a file with the same name.
- `complete` is called with a status that is not configured as completed.

Current error codes:

- `invalid_input`
- `invalid_task_path`
- `invalid_status`
- `task_not_found`
- `task_file_not_found`
- `file_already_exists`
- `extension_invalid`
- `extension_namespace_reserved`
- `extension_namespace_conflict`
- `extension_not_registered`
- `operation_failed`

Use `api.errors` when workflow engines or background listeners need consistent result objects instead of thrown exceptions:

```javascript
const result = await api.errors.toResult(() =>
	api.tasks.complete("Tasks/example.md", { status: "done" })
);

if (!result.ok) {
	console.warn(result.error.code, result.error.details);
	return;
}

console.log(result.value.path);
```

`api.errors.normalize(error)` converts unknown thrown values into a `TaskNotesApiError` payload. Unknown JavaScript errors use `operation_failed` with status `500`.
