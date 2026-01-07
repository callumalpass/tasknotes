# Template Variables Reference

TaskNotes supports template variables for dynamic content generation in body templates, folder paths, and filenames. Variables use the `{{variableName}}` syntax and are replaced with actual values when content is created.

## Overview

Template variables are available in three contexts:

- **Body templates** - Content templates for task and note files
- **Folder templates** - Dynamic folder paths for file organization
- **Filename templates** - Dynamic filename generation

Not all variables are available in every context. The tables below indicate where each variable can be used.

## Task Properties

Variables for task-specific data.

| Variable | Description | Body | Folder | Example |
|----------|-------------|:----:|:------:|---------|
| `{{title}}` | Task title | Yes | Yes | `My Task` |
| `{{titleLower}}` | Title in lowercase | Yes | Yes | `my task` |
| `{{titleUpper}}` | Title in uppercase | Yes | Yes | `MY TASK` |
| `{{titleSnake}}` | Title in snake_case | Yes | Yes | `my_task` |
| `{{titleKebab}}` | Title in kebab-case | Yes | Yes | `my-task` |
| `{{titleCamel}}` | Title in camelCase | Yes | Yes | `myTask` |
| `{{titlePascal}}` | Title in PascalCase | Yes | Yes | `MyTask` |
| `{{priority}}` | Task priority value | Yes | Yes | `high` |
| `{{priorityShort}}` | First character of priority (uppercase) | Yes | Yes | `H` |
| `{{status}}` | Task status value | Yes | Yes | `active` |
| `{{statusShort}}` | First character of status (uppercase) | Yes | Yes | `A` |
| `{{context}}` | First context from contexts array | No | Yes | `work` |
| `{{contexts}}` | All contexts (comma-separated in body, `/` in folder) | Yes | Yes | `work, home` or `work/home` |
| `{{project}}` | First project from projects array | No | Yes | `ProjectA` |
| `{{projects}}` | All projects joined by `/` | No | Yes | `ProjectA/ProjectB` |
| `{{dueDate}}` | Task due date | Yes | Yes | `2025-01-15` |
| `{{scheduledDate}}` | Task scheduled date | Yes | Yes | `2025-01-10` |

## Body Template Only

Variables available only in body templates (not folder templates).

| Variable | Description | Example |
|----------|-------------|---------|
| `{{details}}` | User-provided details/description | `Task description text` |
| `{{parentNote}}` | Parent note name/path where task was created | `Projects/MyNote` |
| `{{tags}}` | Task tags (comma-separated) | `urgent, review` |
| `{{hashtags}}` | Task tags as space-separated hashtags | `#urgent #review` |
| `{{timeEstimate}}` | Time estimate in minutes | `30` |

## Date and Time

Variables for current date and time values.

| Variable | Description | Format | Example |
|----------|-------------|--------|---------|
| `{{date}}` | Full current date | `YYYY-MM-DD` | `2025-01-07` |
| `{{year}}` | Current year | `YYYY` | `2025` |
| `{{shortYear}}` | Short year | `YY` | `25` |
| `{{month}}` | Current month | `MM` | `01` |
| `{{day}}` | Current day | `DD` | `07` |
| `{{monthName}}` | Full month name | - | `January` |
| `{{monthNameShort}}` | Abbreviated month name | - | `Jan` |
| `{{dayName}}` | Full day name | - | `Tuesday` |
| `{{dayNameShort}}` | Abbreviated day name | - | `Tue` |
| `{{week}}` | Week number of year | `WW` | `02` |
| `{{quarter}}` | Quarter of year | `Q` | `1` |
| `{{shortDate}}` | Compact date | `YYMMDD` | `250107` |

### Time Variables

| Variable | Description | Format | Example |
|----------|-------------|--------|---------|
| `{{time}}` | Current time (compact) | `HHmmss` | `143052` |
| `{{time24}}` | 24-hour time | `HH:mm` | `14:30` |
| `{{time12}}` | 12-hour time with AM/PM | `hh:mm a` | `02:30 PM` |
| `{{hour}}` | Current hour (24-hour) | `HH` | `14` |
| `{{hourPadded}}` | Hour with leading zero | `HH` | `14` |
| `{{hour12}}` | Hour in 12-hour format | `hh` | `02` |
| `{{minute}}` | Current minute | `mm` | `30` |
| `{{second}}` | Current second | `ss` | `52` |
| `{{ampm}}` | AM/PM indicator | `a` | `PM` |

### Timestamps

| Variable | Description | Format | Example |
|----------|-------------|--------|---------|
| `{{timestamp}}` | Date and time combined | `YYYY-MM-DD-HHmmss` | `2025-01-07-143052` |
| `{{dateTime}}` | Date and time (no seconds) | `YYYY-MM-DD-HHmm` | `2025-01-07-1430` |
| `{{unix}}` | Unix timestamp (seconds) | - | `1736264852` |
| `{{unixMs}}` | Unix timestamp (milliseconds) | - | `1736264852000` |
| `{{milliseconds}}` | Current milliseconds | `SSS` | `123` |
| `{{ms}}` | Milliseconds (alias) | `SSS` | `123` |

### Timezone

| Variable | Description | Example |
|----------|-------------|---------|
| `{{timezone}}` | Timezone offset | `+01:00` |
| `{{timezoneShort}}` | Short timezone offset | `+0100` |
| `{{utcOffset}}` | UTC offset | `+01:00` |
| `{{utcOffsetShort}}` | Short UTC offset | `+0100` |
| `{{utcZ}}` | UTC Z indicator | `Z` |

### Unique Identifiers

| Variable | Description | Example |
|----------|-------------|---------|
| `{{zettel}}` | Zettelkasten-style ID (date + seconds since midnight in base36) | `250107abc` |
| `{{nano}}` | Unique nano ID (timestamp + random string) | `1736264852000x7k2m` |

## ICS Calendar Event Variables

Variables for content created from ICS calendar events. Available when creating notes or tasks from calendar events.

### Event Information

| Variable | Description | Body | Folder |
|----------|-------------|:----:|:------:|
| `{{icsEventTitle}}` | Event title | Yes | Yes |
| `{{icsEventTitleLower}}` | Event title lowercase | No | Yes |
| `{{icsEventTitleUpper}}` | Event title uppercase | No | Yes |
| `{{icsEventTitleSnake}}` | Event title in snake_case | No | Yes |
| `{{icsEventTitleKebab}}` | Event title in kebab-case | No | Yes |
| `{{icsEventTitleCamel}}` | Event title in camelCase | No | Yes |
| `{{icsEventTitlePascal}}` | Event title in PascalCase | No | Yes |
| `{{icsEventStart}}` | Event start time (ISO format) | Yes | No |
| `{{icsEventEnd}}` | Event end time (ISO format) | Yes | No |
| `{{icsEventLocation}}` | Event location | Yes | Yes |
| `{{icsEventDescription}}` | Event description | Yes | Yes |
| `{{icsEventUrl}}` | Event URL | Yes | No |
| `{{icsEventSubscription}}` | Calendar subscription name | Yes | No |
| `{{icsEventId}}` | Unique event identifier (UUID) | Yes | No |

## Inline Task Conversion Variables

Variables available when converting inline tasks to task files.

| Variable | Description | Example |
|----------|-------------|---------|
| `{{currentNotePath}}` | Path to the current note's folder | `Projects/Notes` |
| `{{currentNoteTitle}}` | Title/name of the current note | `Meeting Notes` |

## Examples

### Body Template

```markdown
---
created: {{date}}
priority: {{priority}}
status: {{status}}
---

# {{title}}

{{details}}

Created from: {{parentNote}}
Tags: {{hashtags}}
```

### Folder Template

Organize tasks by project and status:
```
Tasks/{{project}}/{{status}}
```
Result: `Tasks/MyProject/active`

Organize by date hierarchy:
```
Daily/{{year}}/{{month}}/{{day}}
```
Result: `Daily/2025/01/07`

Organize ICS events by year and title:
```
Events/{{year}}/{{icsEventTitleKebab}}
```
Result: `Events/2025/team-meeting`

### Filename Template

Using Zettelkasten ID:
```
{{zettel}}-{{titleKebab}}
```
Result: `250107abc-my-task.md`

Using timestamp:
```
{{shortDate}}-{{title}}
```
Result: `250107-My Task.md`

## Notes

### YAML Safety

When used in YAML frontmatter, values containing special characters (colons, brackets, quotes) are automatically quoted to prevent parsing errors.

### Folder Path Sanitization

In folder templates, title values have filesystem-unsafe characters (`<>:"/\|?*`) replaced with underscores to ensure valid paths.

### Empty Values

If a variable references data that isn't available (e.g., `{{project}}` when no project is set), it resolves to an empty string.

### Case Transformations

The case transformation variables work as follows:

| Transform | Input | Output |
|-----------|-------|--------|
| `titleLower` | `My Task Name` | `my task name` |
| `titleUpper` | `My Task Name` | `MY TASK NAME` |
| `titleSnake` | `My Task Name` | `my_task_name` |
| `titleKebab` | `My Task Name` | `my-task-name` |
| `titleCamel` | `My Task Name` | `myTaskName` |
| `titlePascal` | `My Task Name` | `MyTaskName` |
