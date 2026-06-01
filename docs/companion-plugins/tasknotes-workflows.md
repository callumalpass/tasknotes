# TaskNotes Workflows

TaskNotes Workflows is a companion plugin for Markdown-defined automation. It lets you create workflow notes that respond to TaskNotes events, schedules, manual commands, and selected Obsidian events, then run typed actions against TaskNotes tasks.

!!! tip "Install TaskNotes Workflows"

    TaskNotes Workflows is published as a separate Obsidian Community Plugin: [install TaskNotes Workflows from the Obsidian plugin directory](https://community.obsidian.md/plugins/tasknotes-workflows).

    In Obsidian, you can also find it under Settings > Community plugins > Browse by searching for `TaskNotes Workflows`.

The plugin is designed for workflows users often ask TaskNotes core to handle, such as:

- Start time tracking when a task becomes active.
- Stop time tracking when a task is completed.
- Move completed tasks into a review folder.
- Copy parent task context, tags, priority, dates, or dependencies to subtasks.
- Warn when a blocked task is moved to active.
- Run a daily review query.

TaskNotes Workflows keeps this behavior outside TaskNotes core while still using the [TaskNotes JavaScript Runtime API](../javascript-api.md) for safe task reads, writes, canonical queries, events, and relationship resolution.

## Requirements

- TaskNotes must be installed and enabled.
- TaskNotes must expose the JavaScript runtime API.
- Obsidian must be open for workflows to run.
- Scheduled workflows run while Obsidian is running. They are not a background service when Obsidian is closed.
- The plugin runtime uses Obsidian APIs only. Node is used for development and build scripts, not for workflow execution, so Markdown workflow definitions can work on Obsidian mobile while the plugin is loaded.

If TaskNotes is disabled or unavailable, the workflow Base can still validate and display workflow files, but TaskNotes read/write steps cannot run.

## Files Created by the Plugin

By default, TaskNotes Workflows uses:

| Path | Purpose |
| --- | --- |
| `TaskNotes/Workflows/` | Workflow Markdown files. |
| `TaskNotes/Views/workflows.base` | Generated Obsidian Base that renders workflow cards through the custom workflow view. |
| Plugin config folder | Run history and detail logs, unless a run-log folder is configured. |

Workflow notes are ordinary Markdown files. The YAML frontmatter is executable configuration, and the note body is for human explanation, testing notes, and maintenance guidance.

## First Run

On first load, the plugin can create a default workflow folder, a workflow Base, and a set of example workflow notes. The default workflow notes are disabled so they can be inspected, dry-run, edited, and enabled intentionally.

The generated Base is the main workbench. It shows workflow cards with status, trigger and step summaries, recent run state, and buttons for editing, dry-running, running, and opening the source note.

Workflow notes also show a compact workflow card in reading mode and live preview, so the note remains useful even when opened directly.

## Default Workflows

The plugin can write these starter workflows:

| Workflow | What it demonstrates |
| --- | --- |
| Auto-start time tracking | Starts a timer when a task status changes to active. |
| Stop time tracking on complete | Stops the timer when a task is completed. |
| Morning overdue review | Runs a daily cron query and marks overdue open tasks high priority. |
| Move completed tasks to review | Moves completed task notes into a review folder. |
| Inherit subtask contexts and tags | Copies contexts and tags from the first parent task when a task becomes a subtask. |
| Inherit subtask priority | Copies priority from the first parent task when a task becomes a subtask. |
| Inherit subtask planning dates | Copies scheduled and due dates from the first parent task when a task becomes a subtask. |
| Inherit subtask dependencies | Adds the first parent task's blocking dependencies to new subtasks. |
| Mirror parent priority to subtasks | Updates existing subtasks when a parent task priority changes. |
| Mirror parent planning dates to subtasks | Updates existing subtasks when a parent scheduled or due date changes. |
| Mirror parent dependencies to subtasks | Replaces each subtask's dependencies with the parent task's current dependencies. |
| Warn when starting a blocked task | Shows a notice when a task becomes active while dependencies remain. |
| Daily active task review | Shows a daily count of tasks still marked active. |

Treat these as editable examples. Adjust folders, statuses, priorities, dates, and filters to match your vault before enabling mutating workflows.

## Workflow Shape

A workflow file looks like this:

```markdown
---
type: tasknotes-workflow
schemaVersion: 1
id: auto-start-time-tracking
name: Auto-start time tracking
enabled: false
description: Start a timer when a task status changes to active.
triggers:
  - id: status-active
    type: tasknotes.event
    event: task.status.changed
    to: active
conditions:
  - field: trigger.after.path
    operator: exists
steps:
  - id: start-time
    type: time.start
    input:
      task: "{{trigger.after.path}}"
      options:
        description: "Started by {{workflow.name}}"
run:
  mode: sequential
  noOverlap: true
  source: tasknotes-workflows
  maxTasks: 1
  onError: stop
---

# Auto-start time tracking

Enable this workflow to start time tracking when a TaskNotes task moves to `active`.
```

Required frontmatter fields:

| Field | Type | Notes |
| --- | --- | --- |
| `type` | string | Must be `tasknotes-workflow`. |
| `schemaVersion` | number | Must be `1`. |
| `id` | string | Stable lowercase identifier. Use letters, numbers, dots, underscores, and dashes. |
| `name` | string | Human-readable name shown in workflow cards and command-palette commands. |
| `enabled` | boolean | Disabled workflows can be edited and dry-run but do not run automatically or from manual commands. |
| `triggers` | array | One or more trigger definitions. |
| `conditions` | array | Optional workflow-level guards. |
| `steps` | array | Linear typed step pipeline. |
| `run` | object | Run policy and safety limits. |

## Triggers

Triggers decide when a workflow should run.

### TaskNotes Events

Use `tasknotes.event` to react to TaskNotes runtime events:

```yaml
triggers:
  - id: status-active
    type: tasknotes.event
    event: task.status.changed
    from: open
    to: active
```

Common event names include:

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
- `time.started`
- `time.stopped`
- `pomodoro.started`
- `pomodoro.completed`
- `pomodoro.interrupted`
- `recurring.instance.completed`
- `recurring.instance.skipped`

The workflow editor loads available TaskNotes events dynamically from `api.events.list()`, so event pickers can follow the runtime API instead of relying on a hardcoded list.

TaskNotes event triggers can use these filters:

| Field | Purpose |
| --- | --- |
| `event` | Runtime event name. |
| `from` | Previous status or value for status-change workflows. |
| `to` | New status or value for status-change workflows. |
| `path.glob` | Optional path glob limiting which task files can trigger the workflow. |
| `allowSelfTrigger` | Allows this workflow to react to writes caused by `tasknotes-workflows`. Leave off unless you have a clear reason. |

TaskNotes event output fields include values such as `trigger.after.path`, `trigger.after.status`, `trigger.before.status`, `trigger.changes`, `trigger.source`, and `trigger.correlationId`.

### Cron

Cron triggers run on matching minutes while Obsidian is open:

```yaml
triggers:
  - id: weekday-review
    type: cron
    schedule: "0 17 * * 1-5"
    timezone: local
```

The schedule uses five fields: minute, hour, day of month, month, day of week. Keep cron workflows bounded with `run.maxTasks`, especially if they query many tasks.

### Interval

Interval triggers run repeatedly while Obsidian is open:

```yaml
triggers:
  - id: half-hour-check
    type: interval
    every: 30m
```

The plugin enforces a minimum interval to avoid excessive background work.

### Manual

Manual triggers let a workflow run from a card button, another plugin, or the Obsidian command palette:

```yaml
triggers:
  - id: manual
    type: manual
```

Enabled workflows with a manual trigger are registered as Obsidian commands named `Run: <workflow name>`. You can launch them from the command palette or assign hotkeys in Obsidian settings.

The generated command id is based on the workflow `id`. Changing a workflow id creates a different command, so any hotkey assigned to the old command id will need to be reassigned.

### Obsidian Events

Advanced Obsidian triggers are opt-in from the plugin settings. They can listen to selected vault, metadata, and workspace events:

```yaml
triggers:
  - id: project-note-opened
    type: obsidian.workspace
    event: file-open
    path:
      glob: "Projects/**/*.md"

  - id: task-note-modified
    type: obsidian.vault
    event: modify
    path:
      glob: "Tasks/**/*.md"

  - id: metadata-changed
    type: obsidian.metadata
    event: changed
    path:
      glob: "Projects/**/*.md"
```

Keep path filters narrow for Obsidian triggers. Vault and metadata events can be frequent.

## Conditions

Conditions can appear at workflow level or on individual steps.

```yaml
conditions:
  - field: trigger.after.path
    operator: exists
  - field: trigger.after.status
    operator: is
    value: active
```

Supported operators:

| Operator | Meaning |
| --- | --- |
| `is` / `isNot` | Exact comparison after scalar normalization. |
| `in` / `notIn` | Check a value against an array. |
| `exists` / `missing` | Check whether a field has a value. |
| `contains` | Check whether a string contains text or an array contains a value. |
| `startsWith` | String prefix check. |
| `before` / `after` | Date comparison. |
| `onOrBefore` / `onOrAfter` | Inclusive date comparison. |

Step-level conditions use the same shape:

```yaml
steps:
  - id: warn
    type: notice.show
    if:
      - field: steps.dependencies.tasks[0].path
        operator: exists
    input:
      message: "This task still has dependencies."
```

## References

References use constrained template expressions. Arbitrary JavaScript is not evaluated.

```text
{{workflow.id}}
{{workflow.name}}
{{trigger.after.path}}
{{trigger.changes.status.after}}
{{steps.query.tasks}}
{{steps.parents.tasks[0].path}}
{{item.path}}
{{today}}
{{now}}
```

If a string is exactly one reference, the underlying value is preserved. If a reference is embedded in other text, the value is stringified.

Use `forEach` when a step should run once per item:

```yaml
steps:
  - id: overdue
    type: task.query
    input:
      query:
        where:
          all:
            - field: task.due
              op: lt
              value:
                fn: today
            - field: task.status
              op: notIn
              value:
                - done
                - cancelled
        sort:
          - field: task.due
            direction: asc
        limit: 50
        scope:
          includeArchived: false

  - id: mark-high
    type: task.patch
    forEach: "{{steps.overdue.tasks}}"
    input:
      task: "{{item.path}}"
      patch:
        priority: high
```

When a step uses `forEach`, `{{item}}` refers to the current item and the step output becomes an array of per-item outputs.

`task.query` uses the canonical TaskNotes runtime query DTO. Its output includes `tasks`, `count`, `total`, `matched`, `returned`, `groups`, `groupPaths`, `query`, and `warnings`.

Runtime query conditions use canonical field IDs and operators:

```yaml
query:
  where:
    all:
      - field: task.status
        op: ne
        value: done
      - any:
          - field: task.due
            op: lte
            value:
              fn: today
          - field: task.priority
            op: eq
            value: high
  sort:
    - field: task.due
      direction: asc
  group:
    - field: task.status
  limit: 25
  scope:
    includeArchived: false
```

Common fields include `task.status`, `task.priority`, `task.due`, `task.scheduled`, `task.projects`, `task.contexts`, `task.tags`, `task.isBlocked`, and `file.path`. Operators include `eq`, `ne`, `contains`, `notContains`, `in`, `notIn`, `exists`, `missing`, `lt`, `lte`, `gt`, `gte`, `isTrue`, and `isFalse`. Use `api.catalog.filterProperties()` and `api.catalog.filterOperators()` for the complete runtime catalog.

## Steps

Steps are typed actions. The editor reads a step catalog so it can show expected inputs, output fields, examples, and TaskNotes option pickers.

Task read steps:

| Step | Output |
| --- | --- |
| `task.get` | One task. |
| `task.query` | Tasks matching a canonical TaskNotes runtime query. |
| `task.parents` | Parent tasks linked from the task's projects. |
| `task.subtasks` | Tasks that reference the current task as a project. |
| `task.dependencies` | Dependencies stored in `blockedBy`, with resolved task data when available. |
| `task.blocking` | Tasks blocked by the current task. |
| `task.relationships` | The task plus parents, subtasks, dependencies, and blocking tasks. |

Task write steps:

| Step | Purpose |
| --- | --- |
| `task.create` | Create a new TaskNotes task. |
| `task.patch` | Update one or more fields. |
| `task.set` | Set one field. |
| `task.move` | Move the task note to a target folder. |
| `task.archive` / `task.unarchive` | Archive or unarchive a task. |
| `task.complete` / `task.uncomplete` | Complete or reopen a task. |
| `task.reschedule` | Update planning dates. |
| `task.setDue` / `task.clearDue` | Set or clear due date. |
| `task.setScheduled` / `task.clearScheduled` | Set or clear scheduled date. |
| `task.addTag` / `task.removeTag` | Mutate tags. |
| `task.addProject` / `task.removeProject` | Mutate project links. |
| `task.addContext` / `task.removeContext` | Mutate contexts. |
| `task.addDependency` / `task.removeDependency` | Mutate blocking dependencies. |

Time and utility steps:

| Step | Purpose |
| --- | --- |
| `time.start` | Start time tracking for a task. |
| `time.stop` | Stop active time tracking for a task. |
| `time.appendEntry` | Append a time entry. |
| `notice.show` | Show an Obsidian notice. |
| `workflow.stop` | Stop a workflow early. |

Companion plugins and scripts can inspect the same catalog through the TaskNotes runtime extension:

```js
const tasknotes = app.plugins.getPlugin("tasknotes")?.api;
const workflows = tasknotes?.extensions.get("tasknotes-workflows");
const steps = workflows?.listStepDefinitions();
```

## Run Policy

Every workflow has a run policy:

```yaml
run:
  mode: sequential
  noOverlap: true
  source: tasknotes-workflows
  maxTasks: 25
  onError: stop
  timeout: 30s
```

| Field | Notes |
| --- | --- |
| `mode` | Currently `sequential`. Steps run in order. |
| `noOverlap` | Skips a new run if the same workflow is already running. |
| `source` | Mutation source passed to TaskNotes runtime API calls. |
| `maxTasks` | Safety limit for `forEach` batch steps. |
| `onError` | `stop` or `continue`. |
| `timeout` | Optional duration string. |

TaskNotes attaches `source`, correlation, and reason metadata to events caused by runtime API writes. Workflows use this to make runs debuggable and to avoid accidental self-trigger loops.

## Run Logs and Debugging

Workflow run logs are stored under the plugin's Obsidian config folder by default. You can configure a run-log folder and a log level in the plugin settings.

Run records include:

- Workflow id, name, and source path.
- Trigger payload.
- Step statuses.
- Inputs and outputs, depending on the configured log level.
- Error text when a run fails.

Use dry runs before enabling workflows that mutate tasks. Dry runs still execute the workflow path, but mutating steps should report what they would do instead of changing task files.

## Example: Manual Command Workflow

This workflow can be run from the command palette after it is enabled:

```markdown
---
type: tasknotes-workflow
schemaVersion: 1
id: show-active-count
name: Show active task count
enabled: true
description: Show a notice with the number of active tasks.
triggers:
  - id: manual
    type: manual
steps:
  - id: active
    type: task.query
    input:
      query:
        where:
          field: task.status
          op: eq
          value: active
        limit: 25
        scope:
          includeArchived: false
  - id: notice
    type: notice.show
    input:
      message: "Active tasks: {{steps.active.count}}"
run:
  mode: sequential
  noOverlap: true
  source: tasknotes-workflows
  maxTasks: 25
  onError: stop
---

# Show active task count

Run this from the Obsidian command palette with `TaskNotes Workflows: Run: Show active task count`.
```

## Example: Inherit Parent Priority

This workflow copies priority from the first parent task when a task becomes a subtask:

```yaml
type: tasknotes-workflow
schemaVersion: 1
id: inherit-subtask-priority
name: Inherit subtask priority
enabled: false
triggers:
  - id: projects-changed
    type: tasknotes.event
    event: task.projects.changed
  - id: task-created
    type: tasknotes.event
    event: task.created
conditions:
  - field: trigger.after.path
    operator: exists
  - field: trigger.after.projects
    operator: exists
steps:
  - id: parents
    type: task.parents
    input:
      task: "{{trigger.after.path}}"
  - id: inherit-priority
    type: task.patch
    if:
      - field: steps.parents.tasks[0].priority
        operator: exists
    input:
      task: "{{trigger.after.path}}"
      patch:
        priority: "{{steps.parents.tasks[0].priority}}"
run:
  mode: sequential
  noOverlap: true
  source: tasknotes-workflows
  maxTasks: 1
  onError: stop
```

This pattern uses `task.parents` rather than trying to parse project links manually.

## Authoring Guidelines

When writing workflow notes:

- Start with `enabled: false` for any workflow that mutates tasks.
- Give every trigger and step a stable `id`.
- Prefer typed TaskNotes steps over direct frontmatter editing.
- Use relationship read steps such as `task.parents`, `task.subtasks`, and `task.dependencies` for parent/subtask/dependency logic.
- Add workflow-level conditions for required trigger fields such as `trigger.after.path`.
- Add `run.noOverlap: true` unless overlapping runs are intentional.
- Set `run.maxTasks` for batch workflows.
- Use `allowSelfTrigger: true` only when the workflow really should react to its own writes.
- Keep the Markdown body useful for future maintenance: describe what the workflow changes, how to test it, and why it exists.

## Troubleshooting

### Task steps do not run

Confirm TaskNotes is enabled and exposes the runtime API. The workflow Base can display definitions without TaskNotes, but steps such as `task.patch`, `time.start`, or `task.dependencies` need TaskNotes.

### A manual workflow is missing from the command palette

Check that:

- The workflow is valid.
- `enabled` is `true`.
- It has a `manual` trigger.
- The workflow `id` is valid and stable.
- Workflows have reloaded after editing the file.

Disabled manual workflows can still be dry-run from the workflow card, but they are not registered as run commands.

### A cron or interval workflow did not run

Scheduled workflows only run while Obsidian is open and the plugin is loaded. Check the schedule, timezone, enabled state, and `run.maxTasks` limit.

### A workflow runs more than once

Check whether multiple triggers match the same update. Also check `allowSelfTrigger`; most workflows should leave it unset so they do not react to writes caused by `tasknotes-workflows`.

### A workflow is invalid

Open the workflow Base or the workflow note card. Validation messages point to the field path, such as `triggers[0].type` or `steps[1].input`.

Common causes are missing required fields, unsupported trigger types, invalid YAML, or references to step outputs that do not exist.
