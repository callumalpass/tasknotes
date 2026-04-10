# TaskNotes Obsidian CLI

TaskNotes can register commands directly with the Obsidian desktop CLI. This is useful when Obsidian is already running and you want shell access to task creation, time tracking, or Pomodoro control without going through the HTTP API.

Use this page for the built-in `obsidian ...` commands exposed by the plugin itself. If you want a standalone terminal tool that works directly on Markdown files without Obsidian running, see [mdbase-tasknotes CLI](mdbase-tasknotes-cli.md).

## Requirements

- Obsidian desktop `1.12.2` or newer
- TaskNotes installed and enabled in the target vault
- Obsidian running when you invoke the CLI

The Obsidian CLI resolves commands against a vault context. In practice, it is safer to pass `vault=<name>` explicitly instead of relying on the default vault.

## Discovering commands

List available TaskNotes commands:

```bash
obsidian help | rg 'tasknotes:'
```

You should see:

- `tasknotes:capture`
- `tasknotes:start-time`
- `tasknotes:stop-time`
- `tasknotes:time-status`
- `tasknotes:pomodoro`

## `tasknotes:capture`

Create a task from free text, explicit flags, or both.

```bash
obsidian tasknotes:capture vault=test text="Review PR tomorrow #work @desk"
```

By default, `text=` is parsed with TaskNotes NLP. Explicit flags override parsed values.

### Literal title mode

Use `literal` when you want the text treated as an exact title instead of being parsed.

```bash
obsidian tasknotes:capture vault=test text="Fix parser edge case" literal
```

### Explicit fields

Supported override flags:

- `title`
- `details`
- `status`
- `priority`
- `due`
- `scheduled`
- `tags`
- `contexts`
- `projects`
- `recurrence`
- `recurrence-anchor`
- `reminders`
- `estimate`

Example:

```bash
obsidian tasknotes:capture vault=test \
  text="Write release notes tomorrow #docs" \
  priority=high \
  status=in-progress \
  reminders='due:-PT1H'
```

### Reminder format

`reminders=` accepts either:

- a semicolon-separated shorthand such as `due:-PT1H;scheduled:-PT30M;at:2026-04-02T09:00`
- a JSON array in the same shape TaskNotes stores internally

### Recurrence anchor

Use `recurrence-anchor=scheduled` or `recurrence-anchor=completion` to control how recurring tasks advance.

## `tasknotes:start-time`

Start time tracking for a task.

You can target a task by:

- `path`
- exact `title`
- fuzzy `query`

Examples:

```bash
obsidian tasknotes:start-time vault=test title="Write release notes"
obsidian tasknotes:start-time vault=test query="release notes" description="Drafting first pass"
obsidian tasknotes:start-time vault=test path="TaskNotes/Write release notes.md"
```

## `tasknotes:stop-time`

Stop time tracking for a task.

Examples:

```bash
obsidian tasknotes:stop-time vault=test title="Write release notes"
obsidian tasknotes:stop-time vault=test path="TaskNotes/Write release notes.md"
```

If you omit task lookup flags, TaskNotes will stop the only active session when that is unambiguous.

## `tasknotes:time-status`

Show time-tracking status for either:

- all active sessions
- one resolved task

Examples:

```bash
obsidian tasknotes:time-status vault=test
obsidian tasknotes:time-status vault=test title="Write release notes"
obsidian tasknotes:time-status vault=test path="TaskNotes/Write release notes.md"
```

When a task is targeted, the command returns that task's summary, active session, and time entries. With no lookup flags, it returns the currently active sessions across the vault.

## `tasknotes:pomodoro`

Control Pomodoro state from the CLI.

Supported actions:

- `status`
- `start`
- `pause`
- `resume`
- `stop`
- `short-break`
- `long-break`

### Inspect state

```bash
obsidian tasknotes:pomodoro vault=test action=status
```

### Start a work session

You can start a Pomodoro with or without a linked task.

```bash
obsidian tasknotes:pomodoro vault=test action=start duration=25
obsidian tasknotes:pomodoro vault=test action=start title="Write release notes" duration=25
```

Task lookup for `action=start` supports the same selectors as time tracking:

- `path`
- exact `title`
- fuzzy `query`

### Pause, resume, and stop

```bash
obsidian tasknotes:pomodoro vault=test action=pause
obsidian tasknotes:pomodoro vault=test action=resume
obsidian tasknotes:pomodoro vault=test action=stop
```

### Breaks

```bash
obsidian tasknotes:pomodoro vault=test action=short-break
obsidian tasknotes:pomodoro vault=test action=long-break
```

## Choosing between CLI surfaces

Use the built-in Obsidian CLI when:

- Obsidian is already open
- you want plugin-aware behavior, including current cache, defaults, templates, time tracking, and Pomodoro state
- you are scripting on the same machine as the running vault

Use [mdbase-tasknotes CLI](mdbase-tasknotes-cli.md) when:

- Obsidian is not running
- you need headless/server workflows
- you want direct file-level automation over a task collection

## Notes

- `path` is the most reliable task selector for automation.
- Immediately after creating a task, exact title lookup can lag briefly until the in-memory cache catches up.
- These commands are desktop-only because they depend on the Obsidian desktop CLI.
