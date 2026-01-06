# Task Defaults

This page documents folder management, filename templates, archive settings, and the template system. These settings are found in the **General** tab.

!!! note "Default Property Values"
    Default values for task properties (status, priority, dates, etc.) are now configured in the [Task Properties](task-properties.md) tab within each property's card.

## Folder and File Management

You can specify a **Default Tasks Folder** where new tasks will be created. You can also configure the **Task Tag** that identifies notes as TaskNotes, and you can specify a list of **Excluded Folders** that will be ignored by the plugin.

Filename generation settings are configured in the **Task Properties** tab within the Title property card. You can choose from title-based, timestamp-based, Zettelkasten-style patterns, or create a custom filename template.

### Folder Template Variables

The **Default Tasks Folder** setting supports dynamic folder creation using template variables. This allows you to automatically organize tasks into folders based on their properties and the current date.

#### Available Template Variables

**Task Variables:**

- `{{context}}` - First context from the task's contexts array
- `{{contexts}}` - All contexts from the task's contexts array, joined by `/`
- `{{project}}` - First project from the task's projects array  
- `{{projects}}` - All projects from the task's projects array, joined by `/`
- `{{priority}}` - Task priority (e.g., "high", "medium", "low")
- `{{status}}` - Task status (e.g., "todo", "in-progress", "done")
- `{{title}}` - Task title (sanitized for folder names)
- `{{dueDate}}` - Task due date (YYYY-MM-DD format)
- `{{scheduledDate}}` - Task scheduled date (YYYY-MM-DD format)
- `{{priorityShort}}` - First letter of priority in uppercase (e.g., "H")
- `{{statusShort}}` - First letter of status in uppercase (e.g., "T")
- `{{titleLower}}` - Task title in lowercase
- `{{titleUpper}}` - Task title in uppercase
- `{{titleSnake}}` - Task title in snake_case
- `{{titleKebab}}` - Task title in kebab-case
- `{{titleCamel}}` - Task title in camelCase
- `{{titlePascal}}` - Task title in PascalCase

**Date Variables:**

- `{{year}}` - Current year (e.g., "2025")
- `{{month}}` - Current month with leading zero (e.g., "08")
- `{{day}}` - Current day with leading zero (e.g., "15")
- `{{date}}` - Full current date (e.g., "2025-08-15")

**Time Variables:**

- `{{time}}` - Current time as HHMMSS (e.g., "143502")
- `{{timestamp}}` - Current timestamp as YYYY-MM-DD-HHMMSS (e.g., "2025-08-15-143502")
- `{{dateTime}}` - Current date and time as YYYY-MM-DD-HHMM (e.g., "2025-08-15-1435")
- `{{hour}}` - Current hour with leading zero (e.g., "14")
- `{{minute}}` - Current minute with leading zero (e.g., "35")
- `{{second}}` - Current second with leading zero (e.g., "02")
- `{{time12}}` - 12-hour time with AM/PM (e.g., "02:35 PM")
- `{{time24}}` - 24-hour time (e.g., "14:35")
- `{{hourPadded}}` - Hour with leading zero (e.g., "14")
- `{{hour12}}` - 12-hour format hour with leading zero (e.g., "02")
- `{{ampm}}` - AM/PM indicator (e.g., "PM")

**Extended Date Variables:**

- `{{shortDate}}` - Short date as YYMMDD (e.g., "250815")
- `{{shortYear}}` - Short year as YY (e.g., "25")
- `{{monthName}}` - Full month name (e.g., "August")
- `{{monthNameShort}}` - Short month name (e.g., "Aug")
- `{{dayName}}` - Full day name (e.g., "Thursday")
- `{{dayNameShort}}` - Short day name (e.g., "Thu")
- `{{week}}` - Week number (e.g., "33")
- `{{quarter}}` - Quarter number (e.g., "3")

**Advanced Variables:**

- `{{unix}}` - Unix timestamp in seconds (e.g., "1692106502")
- `{{unixMs}}` - Unix timestamp in milliseconds (e.g., "1692106502123")
- `{{milliseconds}}` - Milliseconds (e.g., "123")
- `{{ms}}` - Milliseconds (e.g., "123")
- `{{timezone}}` - Timezone offset (e.g., "+10:00")
- `{{timezoneShort}}` - Short timezone offset (e.g., "+1000")
- `{{utcOffset}}` - UTC offset (e.g., "+10:00")
- `{{utcOffsetShort}}` - Short UTC offset (e.g., "+1000")
- `{{utcZ}}` - UTC Z indicator (always "Z")
- `{{zettel}}` - Zettelkasten ID (e.g., "250815abc")
- `{{nano}}` - Nano ID with timestamp and random string

#### Important Notes

- **Variable Processing**: Variables are processed when the task is created, using the actual task properties
- **Missing Values**: If a task doesn't have a value for a variable (e.g., no context assigned), the variable is replaced with an empty string
- **Multiple Values**: For arrays like contexts and projects, only the first value is used
- **Title Sanitization**: The `{{title}}` variable automatically removes invalid folder characters (`<>:"/\|?*`) and replaces them with underscores
- **Folder Creation**: Folders are automatically created if they don't exist
- **Inline Tasks**: Template variables also work for the inline task conversion folder setting

#### Advanced Usage

**Conditional Folder Structures:**
Since missing variables become empty strings, you can create conditional folder structures:
```
Tasks/{{project}}/{{context}}/{{year}}
```
- If both project and context exist: `Tasks/ProjectName/ContextName/2025`
- If only project exists: `Tasks/ProjectName//2025` (note the double slash)
- If neither exists: `Tasks///2025`

**Combining with Static Paths:**
```
Work/{{project}}/{{year}}/{{status}}
Archive/{{year}}/{{month}}/{{project}}
```

## Archive Folder Management

TaskNotes can automatically move tasks to a designated archive folder when archived, and back to the default tasks folder when unarchived.

**Move archived tasks to folder** - Controls whether tasks are automatically moved when archived. Disabled by default.

**Archive folder** - Specifies the destination folder for archived tasks (default: `TaskNotes/Archive`). Only appears when the move setting is enabled. Supports the same template variables as the default tasks folder.

The system prevents file overwrites by checking for existing files and showing error messages if conflicts are detected. Archive operations continue even if file moves fail.

## Filename Template Variables

When using the **custom** filename format, you can create templates using variables that are replaced with actual values when tasks are created.

> **Recommended syntax:** Use double braces `{{variable}}` for consistency with body templates. Single braces `{variable}` are supported for backwards compatibility but are deprecated.

### Available Filename Variables

**Task Properties:**

- `{{title}}` - Task title (sanitized for filenames)
- `{{priority}}` - Task priority (e.g., "high", "medium", "low")
- `{{status}}` - Task status (e.g., "todo", "in-progress", "done")
- `{{dueDate}}` - Task due date (YYYY-MM-DD format)
- `{{scheduledDate}}` - Task scheduled date (YYYY-MM-DD format)
- `{{context}}` - First context from the task's contexts array
- `{{contexts}}` - All contexts joined by `/`
- `{{tags}}` - Task tags (comma-separated)
- `{{hashtags}}` - Task tags as space-separated hashtags (e.g., "#work #urgent")
- `{{timeEstimate}}` - Time estimate in minutes
- `{{details}}` - Task details/description (truncated to 50 characters)
- `{{parentNote}}` - Parent note name where task was created
- `{{priorityShort}}` - First letter of priority in uppercase (e.g., "H")
- `{{statusShort}}` - First letter of status in uppercase (e.g., "T")
- `{{titleLower}}` - Task title in lowercase
- `{{titleUpper}}` - Task title in uppercase
- `{{titleSnake}}` - Task title in snake_case
- `{{titleKebab}}` - Task title in kebab-case
- `{{titleCamel}}` - Task title in camelCase
- `{{titlePascal}}` - Task title in PascalCase

**Date and Time:**

- `{{date}}` - Full date (YYYY-MM-DD format, e.g., "2025-08-15")
- `{{time}}` - Time as HHMMSS (e.g., "143502")
- `{{timestamp}}` - Date and time as YYYY-MM-DD-HHMMSS (e.g., "2025-08-15-143502")
- `{{dateTime}}` - Date and time as YYYY-MM-DD-HHMM (e.g., "2025-08-15-1435")
- `{{year}}` - Year (e.g., "2025")
- `{{month}}` - Month with leading zero (e.g., "08")
- `{{day}}` - Day with leading zero (e.g., "15")
- `{{hour}}` - Hour with leading zero (e.g., "14")
- `{{minute}}` - Minute with leading zero (e.g., "35")
- `{{second}}` - Second with leading zero (e.g., "02")
- `{{shortDate}}` - Short date as YYMMDD (e.g., "250815")
- `{{shortYear}}` - Short year as YY (e.g., "25")
- `{{monthName}}` - Full month name (e.g., "August")
- `{{monthNameShort}}` - Short month name (e.g., "Aug")
- `{{dayName}}` - Full day name (e.g., "Thursday")
- `{{dayNameShort}}` - Short day name (e.g., "Thu")
- `{{week}}` - Week number (e.g., "33")
- `{{quarter}}` - Quarter number (e.g., "3")
- `{{time12}}` - 12-hour time with AM/PM (e.g., "02:35 PM")
- `{{time24}}` - 24-hour time (e.g., "14:35")
- `{{hourPadded}}` - Hour with leading zero (e.g., "14")
- `{{hour12}}` - 12-hour format hour with leading zero (e.g., "02")
- `{{ampm}}` - AM/PM indicator (e.g., "PM")

**Advanced:**

- `{{unix}}` - Unix timestamp in seconds (e.g., "1692106502")
- `{{unixMs}}` - Unix timestamp in milliseconds (e.g., "1692106502123")
- `{{milliseconds}}` - Milliseconds (e.g., "123")
- `{{ms}}` - Milliseconds (e.g., "123")
- `{{timezone}}` - Timezone offset (e.g., "+10:00")
- `{{timezoneShort}}` - Short timezone offset (e.g., "+1000")
- `{{utcOffset}}` - UTC offset (e.g., "+10:00")
- `{{utcOffsetShort}}` - Short UTC offset (e.g., "+1000")
- `{{utcZ}}` - UTC Z indicator (always "Z")
- `{{zettel}}` - Zettelkasten ID (e.g., "250815abc")
- `{{nano}}` - Nano ID with timestamp and random string

### Filename Template Examples

**Date-based with title:**
```
{{year}}-{{month}}-{{day}} {{title}}
```
Result: `2025-08-15 Complete documentation.md`

**Zettelkasten with title:**
```
{{zettel}} {{title}}
```
Result: `250815abc Complete documentation.md`

**Priority and status prefix:**
```
[{{priorityShort}}] {{title}}
```
Result: `[H] Complete documentation.md`

**Custom timestamp:**
```
{{timestamp}}-{{titleKebab}}
```
Result: `2025-08-15-143502-complete-documentation.md`

### ICS Event Filename Variables

For ICS event notes, additional variables are available:

- `{{icsEventTitle}}` - Event title from ICS calendar
- `{{icsEventLocation}}` - Event location
- `{{icsEventDescription}}` - Event description (truncated to 50 characters)
- `{{icsEventTitleWithDate}}` - Event title with formatted date

### Important Notes

- **Unified Syntax**: Both filename and body templates now use double braces `{{variable}}`. Single braces `{variable}` are supported for backwards compatibility but deprecated.
- **Sanitization**: All variables are automatically sanitized to be safe for filenames (invalid characters removed)
- **Empty Values**: If a property doesn't have a value, the variable is replaced with an empty string
- **Character Limits**: Filenames are limited to 255 characters on most systems

### Store Title in Filename

This setting is configured in the **Task Properties** tab within the Title property card.

When enabled, the task's title is stored in the filename instead of frontmatter. The `title` property is removed from frontmatter, and the filename updates when the title changes. This disables other filename templating options.

**Important Considerations:**

- **Backward Compatibility:** This feature is designed to be backward-compatible. Existing tasks with the `title` property in their frontmatter will continue to work as expected. The plugin will always prioritize reading the title from the frontmatter if it exists.
- **New Tasks:** New tasks created with this setting enabled will have their title stored exclusively in the filename.
- **Migration:** To migrate an existing task to this system, rename the file to match the task's title and remove the `title` property from frontmatter.

## Default Reminders

Configure default reminders in **Settings → Task Properties → Reminders**. These reminders automatically apply to new tasks.

### Reminder Types

**Relative reminders** trigger based on a task's due or scheduled date:
- 15 minutes before due date
- 1 hour before scheduled date
- 2 days before due date

**Absolute reminders** trigger at a specific date and time, regardless of task dates.

### Configuration

1. Navigate to Settings → TaskNotes → Task Properties
2. Expand the Reminders card
3. In the Default Reminders section, select type (Relative or Absolute)
4. Configure timing and optional description
5. Click "Add Default Reminder"

Default reminders apply to tasks created via the modal, instant conversion, and natural language parsing. Existing reminders can be viewed, edited, or deleted from the same settings panel.

For detailed reminder documentation, see [Task Reminders](../features/task-management.md#task-reminders).

## Template System

TaskNotes supports **Templates** for both the YAML frontmatter and the body of your task notes. You can use templates to pre-fill common values, add boilerplate text, and create a consistent structure for your tasks. Templates can also include variables, such as `{{title}}`, `{{date}}`, and `{{parentNote}}`, which will be automatically replaced with the appropriate values when a new task is created.

### Unified Template Variables

Body templates now support the same variables as filename templates. All variables listed in the [Filename Template Variables](#filename-template-variables) section above are available in body templates, including:

- All date/time variables (`{{year}}`, `{{month}}`, `{{timestamp}}`, etc.)
- All title variations (`{{titleKebab}}`, `{{titleSnake}}`, etc.)
- Task property variations (`{{priorityShort}}`, `{{statusShort}}`)
- Unique identifiers (`{{zettel}}`, `{{nano}}`)
- Advanced variables (`{{unix}}`, `{{unixMs}}`, etc.)

### Body-Specific Variables

- `{{contexts}}` - Task contexts (comma-separated)
- `{{tags}}` - Task tags (comma-separated)
- `{{hashtags}}` - Task tags as space-separated hashtags
- `{{timeEstimate}}` - Time estimate in minutes
- `{{details}}` - User-provided details/description
- `{{parentNote}}` - Parent note name/path (properly quoted for YAML)

The `{{parentNote}}` variable is particularly useful for project organization. It inserts the parent note as a properly formatted markdown link. 

### Basic Usage

When used in a template like:

```yaml
parent: {{parentNote}}
```

It will resolve to:

```yaml
parent: "[[Project Name]]"
```

### Recommended Usage for Projects

For better alignment with the projects system behavior, it's recommended to use `{{parentNote}}` as a list item in YAML frontmatter:

```yaml
project:
  - {{parentNote}}
```

This will resolve to:

```yaml
project:
  - "[[Project Name]]"
```

This formatting ensures consistency with how the projects system handles multiple project assignments and makes it easy to automatically assign tasks to the project note they were created from during instant conversion.
