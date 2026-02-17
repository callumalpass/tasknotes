# mdbase-tasknotes CLI

[mdbase-tasknotes](https://github.com/callumalpass/mdbase-tasknotes) (`mtn`) is a standalone command-line tool for managing TaskNotes tasks directly on markdown files. It uses [mdbase](https://mdbase.dev) to read and write task files and [tasknotes-nlp-core](https://github.com/callumalpass/tasknotes-nlp-core) for natural language parsing.

[← Back to APIs & Integration](HTTP_API.md)

## When to use this vs tasknotes-cli

TaskNotes ships with [tasknotes-cli](https://github.com/callumalpass/tasknotes-cli) (`tn`), which communicates with the Obsidian plugin over its HTTP API. `mdbase-tasknotes` operates directly on the markdown files instead.

| | `tn` (tasknotes-cli) | `mtn` (mdbase-tasknotes) |
|---|---|---|
| **Requires Obsidian** | Yes — plugin must be running with API enabled | No |
| **Operates on** | HTTP API | Markdown files directly via mdbase |
| **Use when** | Obsidian is open and you want live sync | Obsidian is closed, on a server, or in scripts |
| **Time tracking** | Via plugin API | Via frontmatter `timeEntries` |
| **Task creation** | NLP via API | NLP via bundled `tasknotes-nlp-core` |
| **Install** | `npm install -g tasknotes-cli` | `npm install -g mdbase-tasknotes` |

Use `mtn` when:

- Obsidian isn't running or isn't available (headless servers, SSH sessions, CI pipelines)
- You want to manage tasks from the terminal without any background process
- You're scripting task creation or querying in shell workflows
- You're on a machine where Obsidian isn't installed

Both tools read and write the same task files, so they can be used interchangeably on the same vault.

## Install

```
npm install -g mdbase-tasknotes
```

## Setup

### Using an existing TaskNotes vault

If you already use TaskNotes with mdbase spec generation enabled (Settings → Integrations → Enable mdbase spec), point `mtn` at your vault root:

```bash
mtn config --set collectionPath=/path/to/your/vault
```

The plugin generates `mdbase.yaml` and `_types/task.md` automatically — `mtn` reads these to understand your task schema, including your custom statuses and priorities.

### Creating a standalone collection

To create a new collection without Obsidian:

```bash
mtn init ~/tasks
mtn config --set collectionPath=~/tasks
```

This generates `mdbase.yaml`, `_types/task.md`, and a `tasks/` folder with sensible defaults (statuses: open, in-progress, done, cancelled; priorities: low, normal, high, urgent).

## Creating tasks

Create tasks using natural language. Tags, contexts, projects, dates, priorities, and recurrence are extracted automatically:

```bash
mtn create "Buy groceries tomorrow #shopping @errands"
mtn create "Write quarterly report due friday #work +quarterly-review"
mtn create "Call dentist high priority @phone"
mtn create "Water plants every monday #home"
```

### Supported patterns

| Pattern | Example | Extracted as |
|---|---|---|
| `#tag` | `#shopping` | Tag |
| `@context` | `@errands` | Context |
| `+project` | `+quarterly-review` | Project (stored as wikilink) |
| Date words | `tomorrow`, `friday`, `next week` | Due date |
| Priority words | `high priority`, `urgent` | Priority |
| Recurrence | `every day`, `weekly`, `every monday` | Recurrence rule |
| Estimate | `~30m`, `~2h` | Time estimate |

The NLP parser reads your collection's status and priority enum values from `_types/task.md`, so any custom values you define there are automatically recognized.

## Querying tasks

### List tasks

```bash
# Default: open tasks ordered by due date
mtn list

# Filter by status, priority, or tag
mtn list --status in-progress
mtn list --priority high
mtn list --tag work

# Show overdue tasks
mtn list --overdue

# Raw mdbase where expression
mtn list --where 'due < "2026-03-01" && priority == "urgent"'

# JSON output for scripting
mtn list --json
```

### Show task detail

```bash
mtn show "Buy groceries"
mtn show tasks/Buy\ groceries.md
```

Tasks can be referenced by title or file path. Title matching tries exact match first, then substring.

### Search

Full-text search across titles, body content, tags, contexts, and projects:

```bash
mtn search quarterly
```

## Updating tasks

### Complete a task

```bash
mtn complete "Buy groceries"
```

Sets status to `done` and records the completion date.

### Update fields

```bash
mtn update "Write report" --status in-progress
mtn update "Write report" --priority urgent --due 2026-03-01
mtn update "Write report" --add-tag important --remove-tag draft
mtn update "Write report" --add-context office
```

### Archive and delete

```bash
mtn archive "Write report"     # Adds "archive" tag
mtn delete "Old task"           # Checks for backlinks first
mtn delete "Old task" --force   # Skip backlink check
```

## Time tracking

Track time spent on tasks via the `timeEntries` frontmatter field — the same format TaskNotes uses.

```bash
# Start a timer
mtn timer start "Write report"
mtn timer start "Write report" -d "Drafting introduction"

# Check active timers
mtn timer status

# Stop the running timer
mtn timer stop

# View time log
mtn timer log
mtn timer log --period today
mtn timer log --period week
mtn timer log --from 2026-02-01 --to 2026-02-28
```

## Projects and statistics

### Projects

```bash
# List all projects
mtn projects list
mtn projects list --stats    # With completion percentages

# Show tasks for a project
mtn projects show quarterly-review
```

### Statistics

```bash
mtn stats
```

Shows total tasks, completion rate, overdue count, breakdown by status and priority, and total time tracked.

## Interactive mode

Launch a REPL with live NLP preview that updates as you type:

```bash
mtn interactive
# or
mtn i
```

Type a task description and the preview line shows how it will be parsed (title, tags, dates, priority). Press Enter to create the task.

## Configuration

Configuration is stored at `~/.config/mdbase-tasknotes/config.json`.

```bash
mtn config --list                              # Show all settings
mtn config --set collectionPath=/path/to/vault  # Set collection path
mtn config --get collectionPath                 # Get a setting
```

### Collection path resolution

The collection path is resolved in order:

1. `--path` / `-p` flag on any command
2. `MDBASE_TASKNOTES_PATH` environment variable
3. `collectionPath` in config file
4. Current working directory

## Command reference

| Command | Alias | Description |
|---|---|---|
| `mtn init [path]` | | Initialize a new collection |
| `mtn create <text...>` | | Create a task from natural language |
| `mtn list [options]` | `ls` | List tasks with filters |
| `mtn show <task>` | | Show full task detail |
| `mtn complete <task>` | `done` | Mark task as completed |
| `mtn update <task> [options]` | | Update task fields |
| `mtn delete <task>` | `rm` | Delete a task |
| `mtn archive <task>` | | Add archive tag |
| `mtn search <query>` | | Full-text search |
| `mtn timer start <task>` | | Start time tracking |
| `mtn timer stop` | | Stop running timer |
| `mtn timer status` | | Show active timers |
| `mtn timer log` | | Show time entry log |
| `mtn projects list` | | List projects |
| `mtn projects show <name>` | | Show project tasks |
| `mtn stats` | | Show task statistics |
| `mtn interactive` | `i` | Interactive REPL |
| `mtn config [options]` | | Manage configuration |
