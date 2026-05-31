# TaskNotes JavaScript Runtime API

TaskNotes exposes an in-process runtime API on the loaded Obsidian plugin instance:

```javascript
const tasknotes = app.plugins.plugins.tasknotes;
const api = tasknotes?.api;
```

This API is for Obsidian companion plugins and in-vault scripting tools such as Templater, QuickAdd, and MetaBind. It runs inside Obsidian and uses the same TaskNotes services, settings, cache, and vault permissions as the plugin UI.

This is separate from the [HTTP API](HTTP_API.md). The runtime API does not start a server, does not use bearer-token authentication, and is only available inside the running Obsidian app.

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

- `extensions.read`
- `extensions.register`
- `tasks.read`
- `tasks.write`
- `tasks.delete`
- `tasks.move`
- `tasks.events`
- `time.read`
- `time.write`
- `pomodoro.read`
- `pomodoro.write`
- `pomodoro.events`
- `recurring.write`
- `recurring.events`
- `settings.snapshot`
- `nlp.parse`

## Namespaces

Prefer the namespaced API for new code:

```javascript
await api.tasks.update("Tasks/example.md", { status: "active" });
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
    }
  }
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

## Tasks

All paths are vault-relative Markdown file paths.

| Method | Description |
| --- | --- |
| `api.tasks.get(path)` | Returns a task by path, or `null` when no task is cached at that path. |
| `api.tasks.list(query?)` | Returns all tasks, or tasks matching a TaskNotes `FilterQuery`. |
| `api.tasks.create(taskData, context?)` | Creates a task using the normal TaskNotes creation service. |
| `api.tasks.update(path, patch, context?)` | Updates one or more task fields using the normal TaskNotes update service. |
| `api.tasks.delete(path, context?)` | Deletes the task file through TaskNotes' delete service. |
| `api.tasks.complete(path, options?, context?)` | Marks a task complete. |
| `api.tasks.uncomplete(path, options?, context?)` | Moves a completed task back to a non-completed status. |
| `api.tasks.setStatus(path, status, context?)` | Sets task status. |
| `api.tasks.setPriority(path, priority, context?)` | Sets task priority. |
| `api.tasks.setDue(path, date, context?)` / `clearDue(path, context?)` | Sets or clears due date. |
| `api.tasks.setScheduled(path, date, context?)` / `clearScheduled(path, context?)` | Sets or clears scheduled date. |
| `api.tasks.archive(path, archived, context?)` | Archives or unarchives a task, including archive-folder movement when configured. |
| `api.tasks.move(path, targetFolder, context?)` | Moves the task note and refuses to overwrite an existing file. |
| `api.tasks.addTag/removeTag` | Mutates task tags. |
| `api.tasks.addProject/removeProject` | Mutates project links. |
| `api.tasks.addContext/removeContext` | Mutates contexts. |
| `api.tasks.setReminders/addReminder/removeReminder` | Mutates reminders. |
| `api.tasks.addDependency/removeDependency` | Mutates blocking dependencies stored in `blockedBy`. |

Example:

```javascript
const task = await api.tasks.create(
  {
    title: "Review automation design",
    status: "open",
    priority: "normal",
    scheduled: "2026-06-01",
    tags: ["tasknotes"]
  },
  {
    source: "my-companion-plugin",
    correlationId: crypto.randomUUID(),
    reason: "manual workflow command"
  }
);

await api.tasks.complete(task.path);
```

## Time Tracking

| Method | Description |
| --- | --- |
| `api.time.start(path, options?, context?)` | Starts time tracking and returns the updated task. |
| `api.time.stop(path, context?)` | Stops the active time entry and returns the updated task. |
| `api.time.active()` | Returns active time entries with task, path, entry, and entry index. |
| `api.time.append(path, entry, context?)` | Appends a time entry. |
| `api.time.deleteEntry(path, entryIndex, context?)` | Deletes a time entry through TaskNotes' service. |

## Pomodoro

| Method | Description |
| --- | --- |
| `api.pomodoro.status()` | Returns current Pomodoro state. |
| `api.pomodoro.start(options?, context?)` | Starts a Pomodoro session. |
| `api.pomodoro.stop(context?)` | Stops and resets the active Pomodoro session. |
| `api.pomodoro.pause(context?)` | Pauses the current session. |
| `api.pomodoro.resume(context?)` | Resumes a paused session. |
| `api.pomodoro.assignTask(pathOrNull, context?)` | Assigns or clears the current session task. |
| `api.pomodoro.sessions(options?)` | Returns Pomodoro session history. |
| `api.pomodoro.stats(date?)` | Returns Pomodoro stats for a date or today. |

## Recurring Tasks

| Method | Description |
| --- | --- |
| `api.recurring.toggleCompleteInstance(path, date?, context?)` | Toggles completion for a recurring task instance. |
| `api.recurring.toggleSkippedInstance(path, date?, context?)` | Toggles skipped state for a recurring task instance. |

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
      reason: "status changed to active"
    });
  })
);
```

## Error Handling

API methods throw JavaScript errors for invalid input or failed operations. Common examples:

- The task path is empty or invalid.
- No task exists at the requested path.
- A target move folder already contains a file with the same name.
- `complete` is called with a status that is not configured as completed.

Wrap API calls in `try`/`catch` when running workflows or background listeners.
