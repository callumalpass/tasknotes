# Task Management


This page covers task creation, properties, projects, dependencies, recurring tasks, and reminders. For the underlying architecture, see [Core Concepts](../core-concepts.md).

Use this page as the operational overview: how tasks are captured, how they are structured, and how relationships/automation behave. Detailed reference content for recurrence and reminders is split into dedicated pages linked near the end.

## Creating and Editing Tasks

You can create and edit tasks in a variety of ways. The primary method is through the **Task Creation Modal**, which can be accessed via the "Create new task" command or by clicking on dates or time slots in the calendar views. This modal provides an interface for setting all available task properties, including title, status, priority, and due dates.

![Task creation modal](../assets/feature-task-modal-filled.png)

When creating a task, the title will be automatically sanitized to remove any characters that are forbidden in filenames.

TaskNotes also supports **Natural Language Creation**, which allows you to create tasks by typing descriptions in plain English. The built-in parser can extract structured data from phrases like "Buy groceries tomorrow at 3pm @home #errands high priority."

In most workflows, users combine both approaches: fast capture with natural language, then occasional structured edits in the modal when more precision is needed.

### Auto-Suggestions in Natural Language Input

The natural language input field includes auto-suggestion functionality that activates when typing specific trigger characters:

- **@** - Shows available contexts from existing tasks
- **#** - Shows available tags from existing tasks
- **+** - Shows files from your vault as project suggestions
- **\*** - Shows available status options (configurable trigger in Settings → Features)

#### Project Suggestions

When typing `+` in the natural language input, you'll see up to 20 suggestions from your vault's markdown files. The suggestions display additional information to help identify files:

```
project-alpha [title: Alpha Project Development | aliases: alpha, proj-alpha]
meeting-notes [title: Weekly Team Meeting Notes]
simple-project
work-file [aliases: work, office-tasks]
```

Project suggestions search across:
- File names (basename without extension)
- Frontmatter titles (using your configured field mapping)
- Frontmatter aliases
- Optional filtering by required tags, folders, and a specific frontmatter property/value defined in Settings → Appearance & UI → Project Autosuggest

Selecting a project suggestion inserts it as `+[[filename]]`, creating a wikilink to the file while maintaining the `+` project marker that the natural language parser recognizes.


#### Enhanced Project Auto‑suggester (configurable cards)

Project suggestions can display configurable multi‑row cards and support smarter search. Configure up to 3 rows using a simple token syntax in Settings → Appearance & UI → Project Autosuggest.

- Properties: file.basename, file.name, file.path, file.parent, title, aliases, and any frontmatter key
- Flags:
  - n or n(Label) → show the field name/label before the value
  - s → include this field in + search (in addition to defaults)
- Literals: you can mix in fixed text or emojis between tokens

Examples

- "{title|n(Title)}" → Title: Alpha Project
- "🔖 {aliases|n(Aliases)}" → 🔖 Aliases: alpha, proj-alpha
- "{file.path|n(Path)|s}" → include path in + search as well as display it

Search behavior

- Defaults: + search always includes file basename, title (via your field mapping), and aliases
- |s flag: add more searchable fields on top of the defaults (e.g., file.path or a custom frontmatter key like customer)
- Fuzzy: optional fuzzy matching can be enabled in settings for broader, multi‑word matches

Performance tips

- Keep rows to three or fewer for clarity and performance (the UI supports up to 3)
- Prefer specific searchable fields with |s on large vaults

Demo

![Autosuggest projects with spaces](../assets/autosuggest_project_names_with_space.gif)

![Enhanced project autosuggester](../assets/enhanced-project-auto-suggester.gif)


#### Status Suggestions

When typing the status trigger character (default `*`) in the natural language input, you'll see suggestions for all configured status options:

![Status Auto-Suggestion](../assets/auto-suggest-status.gif)

Status suggestions allow quick selection of statuses when creating tasks. For example, typing `*in` shows "In Progress" as a suggestion if that's one of your configured statuses.

Additionally, you can convert any line type in your notes to TaskNotes using the **Instant Conversion** feature. This works with checkboxes, bullet points, numbered lists, blockquotes, headers, and plain text lines.

## Task Properties

Tasks store their data in YAML frontmatter with properties for status, priority, dates, contexts, projects, tags, time estimates, recurrence, and reminders. Custom fields can extend this structure.

This frontmatter-first design keeps task data editable and portable while still supporting rich UI interactions across views and widgets.

For property types and examples, see [Core Concepts](../core-concepts.md#yaml-frontmatter). For configuration options, see [Task Properties Settings](../settings/task-properties.md).

## Projects

TaskNotes supports organizing tasks into projects using note-based linking. Projects are represented as links to actual notes in your vault, allowing you to leverage Obsidian's linking and backlinking features for project management.

This model avoids creating a separate project database. Any note can become a project anchor, and task/project relationships remain visible through normal Obsidian link tooling.

### Project Assignment

Tasks can be assigned to one or more projects through the task creation or editing interface. When creating or editing a task, click the "Add Project" button to open the project selection modal. This modal provides fuzzy search functionality to quickly find and select project notes from your vault.

### Project Links

Projects are stored as wikilinks in the task's frontmatter (e.g., `projects: ["[[Project A]]", "[[Project B]]"]`). These links are clickable in the task interface and will navigate directly to the project notes when clicked. Any note in your vault can serve as a project note simply by being linked from a task's projects field.

### Organization and Filtering

Tasks can be filtered and grouped by their associated projects in all Bases-driven task views. Use the Bases filter editor to add `note.projects` conditions, and configure the grouping menu to organize Task List or Kanban boards by project. Tasks assigned to multiple projects will appear in each relevant project group, providing flexibility in project-based organization.

### Project Indicators

TaskCards display visual indicators when tasks are used as projects. These indicators help identify which tasks have other tasks linked to them as subtasks, making project hierarchy visible at a glance.

### Subtask Creation

Tasks can have subtasks created directly from their context menu. When viewing a task that serves as a project, you can select "Create subtask" to create a new task automatically linked to the current project.

## Dependencies

Task dependencies capture prerequisite work using RFC&nbsp;9253 terminology. Dependencies are stored in frontmatter as structured objects:

```yaml
blockedBy:
  - uid: "[[Operations/Order hardware]]"
    reltype: FINISHTOSTART
    gap: P1D
```

- `uid` references the blocking task, typically through an Obsidian wikilink.
- `reltype` is stored with each dependency and defaults to `FINISHTOSTART` for dependencies created in the UI.
- `gap` is optional and uses ISO&nbsp;8601 duration syntax (for example `PT4H` or `P2D`).

Whenever a dependency is added, TaskNotes updates the upstream note’s `blocking` list so the reverse relationship stays synchronized. Removing a dependency automatically clears both sides.

### Selecting dependencies in the UI

- The task creation and edit modals expose “Blocked by” and “Blocking” buttons that launch a fuzzy task selector. The picker only offers valid tasks, excludes the current note, and prevents duplicate entries.
- The task context menu provides the same selector, enabling dependency management directly from the Task List, Kanban, and calendar views.
- Task cards show a fork icon whenever a task blocks other work. Clicking it expands an inline list of downstream tasks without triggering the parent card’s modal, so you can inspect dependents in place.

These controls currently create and manage finish-to-start style blockers. Advanced `reltype` values and `gap` data are preserved in frontmatter, but blocking evaluation is currently based on whether unresolved dependencies exist rather than relationship-type-specific scheduling rules.

![Task context menu](../assets/feature-task-context-menu.png)

## Automation

### Auto-Archiving

TaskNotes can automatically archive tasks when they transition into a status that has auto-archiving enabled. This keeps completed work out of your active lists without requiring manual cleanup.

Configure auto-archiving per status from **Settings → Task Properties → Task Statuses**. Each status card includes an **Auto-archive** toggle and a **Delay (minutes)** input (1–1440). When you turn the toggle on for a status, any task moved into that status is queued for archiving once the delay elapses. Moving the task to a different status before the timer expires cancels the pending archive automatically.

The auto-archive queue runs in the background and persists across plugin restarts. If TaskNotes was closed while an archive was pending, the task will be archived shortly after the plugin loads again as long as it still matches the configured status.

This automation is intended to keep active views focused without manual cleanup, while still preserving archived task history in your vault.

## File Management and Templates

TaskNotes supports configurable task folder locations, filename generation patterns, archive behavior, and body templates for newly created tasks.

These settings let you align task files with existing vault conventions (for example, date-based folders, project-based routing, or template-driven task note scaffolds).

For configuration details, see [Task Defaults](../settings/task-defaults.md).  
For template variables, see [Template Variables Reference](template-variables.md).

## Recurring Tasks

TaskNotes recurring tasks use RFC 5545 RRule syntax with `DTSTART`, separate pattern definition from next occurrence scheduling, and support independent instance completion.

For full behavior, examples, and edge cases, see [Recurring Tasks](recurring-tasks.md).

## Task Reminders

Task reminders support relative offsets from due/scheduled dates and absolute date-time reminders. You can add reminders from task modals, task cards, and context menus.

For full setup, data format, defaults, and UI behavior, see [Task Reminders](reminders.md).
