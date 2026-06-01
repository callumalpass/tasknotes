# Companion Plugins

Companion plugins are optional Obsidian plugins that build on TaskNotes without adding every workflow to the core plugin. They run inside the same Obsidian app, use TaskNotes' runtime API for live task reads and writes, and keep task data in ordinary Markdown files.

Use companion plugins when you want a deeper product surface than a script or webhook, but you still want TaskNotes itself to stay focused on task storage, editing, views, time tracking, and calendar behavior.

## Available Companion Plugins

| Plugin | Purpose | Documentation |
| --- | --- | --- |
| TaskNotes Workflows | Markdown-defined automation for TaskNotes tasks, schedules, events, and manual command-palette workflows. | [TaskNotes Workflows](companion-plugins/tasknotes-workflows.md) |

More companion plugins may be documented here over time.

## How Companion Plugins Relate to TaskNotes

TaskNotes remains the source of truth for task behavior. Companion plugins should use the [TaskNotes JavaScript Runtime API](javascript-api.md) for live vault operations instead of rewriting TaskNotes frontmatter directly. This keeps task updates consistent with TaskNotes settings, task cache, events, calendar behavior, time tracking, and future data-model changes.

Companion plugins can also publish their own runtime surface through `api.extensions`. Other plugins and scripts can discover those extension APIs from TaskNotes:

```js
const tasknotes = app.plugins.getPlugin("tasknotes");
const workflows = tasknotes?.api?.extensions.get("tasknotes-workflows");
```

The extension registry is useful when companion plugins need to expose commands, validation helpers, catalogs, or run APIs to other in-vault tools.

## Choosing an Integration Surface

| Use case | Prefer |
| --- | --- |
| A user-facing Obsidian UI that works with TaskNotes tasks | Companion plugin |
| In-vault scripting with Templater, QuickAdd, MetaBind, or another plugin | [JavaScript Runtime API](javascript-api.md) |
| Local tools outside Obsidian | [HTTP API](HTTP_API.md) or [TaskNotes Obsidian CLI](obsidian-cli.md) |
| Notifications to external services when tasks change | [Webhooks](webhooks.md) |
| Direct file analysis without Obsidian running | [mdbase-tasknotes CLI](mdbase-tasknotes-cli.md) |

## Compatibility Expectations

Companion plugins should:

- Check `api.apiVersion` and `api.hasCapability(...)` before using runtime features.
- Include a `source` value when mutating tasks so TaskNotes events are debuggable.
- Avoid reacting to their own mutations unless the behavior is explicit.
- Keep user data in the vault where possible, using readable Markdown or JSON files.
- Treat TaskNotes task notes and Bases files as user-owned documents.

TaskNotes does not need every companion plugin installed. If a companion plugin is disabled, TaskNotes task notes remain normal Markdown files and TaskNotes core views continue to work.
