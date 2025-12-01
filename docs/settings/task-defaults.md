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

### Available Filename Variables

**Task Properties:**

- `{title}` - Task title (sanitized for filenames)
- `{priority}` - Task priority (e.g., "high", "medium", "low")
- `{status}` - Task status (e.g., "todo", "in-progress", "done")
- `{dueDate}` - Task due date (YYYY-MM-DD format)
- `{scheduledDate}` - Task scheduled date (YYYY-MM-DD format)
- `{priorityShort}` - First letter of priority in uppercase (e.g., "H")
- `{statusShort}` - First letter of status in uppercase (e.g., "T")
- `{titleLower}` - Task title in lowercase
- `{titleUpper}` - Task title in uppercase
- `{titleSnake}` - Task title in snake_case
- `{titleKebab}` - Task title in kebab-case
- `{titleCamel}` - Task title in camelCase
- `{titlePascal}` - Task title in PascalCase

**Date and Time:**

- `{date}` - Full date (YYYY-MM-DD format, e.g., "2025-08-15")
- `{time}` - Time as HHMMSS (e.g., "143502")
- `{timestamp}` - Date and time as YYYY-MM-DD-HHMMSS (e.g., "2025-08-15-143502")
- `{dateTime}` - Date and time as YYYY-MM-DD-HHMM (e.g., "2025-08-15-1435")
- `{year}` - Year (e.g., "2025")
- `{month}` - Month with leading zero (e.g., "08")
- `{day}` - Day with leading zero (e.g., "15")
- `{hour}` - Hour with leading zero (e.g., "14")
- `{minute}` - Minute with leading zero (e.g., "35")
- `{second}` - Second with leading zero (e.g., "02")
- `{shortDate}` - Short date as YYMMDD (e.g., "250815")
- `{monthName}` - Full month name (e.g., "August")
- `{monthNameShort}` - Short month name (e.g., "Aug")
- `{dayName}` - Full day name (e.g., "Thursday")
- `{dayNameShort}` - Short day name (e.g., "Thu")
- `{week}` - Week number (e.g., "33")
- `{quarter}` - Quarter number (e.g., "3")
- `{time12}` - 12-hour time with AM/PM (e.g., "02:35 PM")
- `{time24}` - 24-hour time (e.g., "14:35")
- `{hourPadded}` - Hour with leading zero (e.g., "14")
- `{hour12}` - 12-hour format hour with leading zero (e.g., "02")
- `{ampm}` - AM/PM indicator (e.g., "PM")

**Advanced:**

- `{unix}` - Unix timestamp in seconds (e.g., "1692106502")
- `{unixMs}` - Unix timestamp in milliseconds (e.g., "1692106502123")
- `{milliseconds}` - Milliseconds (e.g., "123")
- `{ms}` - Milliseconds (e.g., "123")
- `{timezone}` - Timezone offset (e.g., "+10:00")
- `{timezoneShort}` - Short timezone offset (e.g., "+1000")
- `{utcOffset}` - UTC offset (e.g., "+10:00")
- `{utcOffsetShort}` - Short UTC offset (e.g., "+1000")
- `{utcZ}` - UTC Z indicator (always "Z")
- `{zettel}` - Zettelkasten ID (e.g., "250815abc")
- `{nano}` - Nano ID with timestamp and random string

### Filename Template Examples

**Date-based with title:**
```
{year}-{month}-{day} {title}
```
Result: `2025-08-15 Complete documentation.md`

**Zettelkasten with title:**
```
{zettel} {title}
```
Result: `250815abc Complete documentation.md`

**Priority and status prefix:**
```
[{priorityShort}] {title}
```
Result: `[H] Complete documentation.md`

**Custom timestamp:**
```
{timestamp}-{titleKebab}
```
Result: `2025-08-15-143502-complete-documentation.md`

### ICS Event Filename Variables

For ICS event notes, additional variables are available:

- `{icsEventTitle}` - Event title from ICS calendar
- `{icsEventLocation}` - Event location
- `{icsEventDescription}` - Event description (truncated to 50 characters)
- `{icsEventTitleWithDate}` - Event title with formatted date

### Important Notes

- **Single Braces**: Filename variables use single braces `{variable}` while folder variables use double braces `{{variable}}`
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

Default reminders are configured in the **Task Properties** tab within the Reminders property card. Each reminder you configure will be automatically applied to new tasks.

### Configuring Default Reminders

1. Open TaskNotes settings (Settings → TaskNotes)
2. Navigate to the "Task Properties" tab
3. Expand the "Reminders" property card
4. Use the "Default Reminders" section to add new reminders

### Default Reminder Types

You can configure both types of reminders as defaults:

#### Relative Default Reminders

Relative default reminders are triggered relative to a task's due date or scheduled date:

- **Anchor Date**: Choose between "due date" or "scheduled date"
- **Timing**: Specify the offset (e.g., 15 minutes, 1 hour, 2 days)
- **Direction**: Choose "before" or "after" the anchor date
- **Description**: Optional custom reminder message

**Example Configurations:**
```
15 minutes before due date
1 hour before scheduled date  
2 days before due date
30 minutes after scheduled date
```

#### Absolute Default Reminders

Absolute default reminders are triggered at specific dates and times:

- **Date**: Set the specific date for the reminder
- **Time**: Set the specific time for the reminder  
- **Description**: Optional custom reminder message

**Example Configurations:**

```
Every Monday at 9:00 AM (for weekly planning)
October 26, 2025 at 2:30 PM (for project deadline)
Tomorrow at 10:00 AM (for follow-up tasks)
```

### Default Reminder Application

Default reminders automatically apply to new tasks created through:

#### Manual Task Creation

- Tasks created using the Task Creation Modal
- Default reminders are added automatically based on available anchor dates
- Additional reminders can be added during the creation process

#### Instant Conversion

- Tasks created by converting existing content (checkboxes, bullet points, etc.)
- Default reminders apply based on the converted task's properties
- Respects existing due and scheduled dates from natural language parsing

#### Natural Language Task Creation

- Tasks created using the natural language parser
- Default reminders integrate with parsed task properties
- Applied after natural language processing is complete

### Managing Default Reminders

#### Adding Default Reminders

Use the form interface in settings to add new default reminders:

1. **Select Reminder Type**: Choose between "Relative" or "Absolute"
2. **Configure Timing**: Set the specific timing parameters
3. **Add Description**: Optionally add a custom reminder message
4. **Save Configuration**: Click "Add Default Reminder" to save

#### Editing Default Reminders

Default reminders can be managed through the settings interface:

- **View All Defaults**: See a list of all configured default reminders
- **Delete Defaults**: Remove unwanted default reminders
- **Modify Settings**: Edit timing, descriptions, and other parameters

### Default Reminder Examples

#### Common Workflow Patterns

**Getting Things Done (GTD) Setup:**

```
15 minutes before due date (quick review)
1 day before due date (preparation time)
```

**Time-blocking Setup:**

```
30 minutes before scheduled date (preparation)
5 minutes before scheduled date (start notification)
```

**Project Management Setup:**  

```
1 week before due date (progress check)
2 days before due date (final review)
4 hours before due date (completion deadline)
```

#### Task Type Specific Defaults

**Meeting Tasks:**

```
30 minutes before scheduled date (preparation)
5 minutes before scheduled date (join notification)
```

**Deadline Tasks:**

```
1 week before due date (progress milestone)
2 days before due date (completion buffer)
4 hours before due date (final submission)
```

**Follow-up Tasks:**

```
Absolute reminder: Next Monday at 9:00 AM
Relative reminder: 1 day after due date (if not completed)
```

### Integration with Existing Settings

#### Field Mapping Compatibility

Default reminders integrate with the Field Mapping system:

- **Custom Property Names**: Map reminders to custom frontmatter property names
- **Vault Compatibility**: Adapt to existing vault structures
- **Migration Support**: Maintain compatibility when changing field mappings

#### Template Integration

Default reminders work alongside template systems:

- **Applied After Templates**: Default reminders are added after template processing
- **Template Variables**: Templates can reference reminder-related variables
- **Combined Workflows**: Templates and default reminders complement each other

### Data Storage and Format

Default reminders are stored in your TaskNotes settings and converted to task reminders when new tasks are created. They maintain the same data structure as task reminders:

#### Settings Storage Format

```json
{
  "defaultReminders": [
    {
      "id": "def_rem_1678886400000",
      "type": "relative",
      "relatedTo": "due",
      "offset": 15,
      "unit": "minutes", 
      "direction": "before",
      "description": "Task review reminder"
    },
    {
      "id": "def_rem_1678886400001", 
      "type": "absolute",
      "absoluteDate": "2025-10-26",
      "absoluteTime": "09:00",
      "description": "Weekly planning session"
    }
  ]
}
```

#### Task Application Format

When applied to tasks, default reminders are converted to the standard reminder format:

```yaml
reminders:
  - id: "rem_1678886400000_abc123xyz"
    type: "relative"
    relatedTo: "due" 
    offset: "-PT15M"
    description: "Task review reminder"
  - id: "rem_1678886400001_def456uvw"
    type: "absolute"
    absoluteTime: "2025-10-26T09:00:00"
    description: "Weekly planning session"
```

### Best Practices

#### Reminder Strategy

**Start Simple:** Begin with one or two common default reminders and add more as needed.

**Consider Context:** Different types of tasks may benefit from different reminder patterns.

**Avoid Overloading:** Too many default reminders can become overwhelming and reduce their effectiveness.

#### Timing Considerations

**Buffer Time:** Include enough lead time for preparation and action.

**Multiple Alerts:** Use multiple reminders for important deadlines (e.g., 1 week, 2 days, 4 hours before).

**Personal Patterns:** Align reminder timing with your personal work patterns and schedule.

#### Maintenance

**Regular Review:** Periodically review and adjust default reminders based on effectiveness.

**Seasonal Adjustments:** Consider adjusting reminder patterns for different seasons or project types.

**Feedback Integration:** Use your experience with reminders to refine default configurations.

## Template System

TaskNotes supports **Templates** for both the YAML frontmatter and the body of your task notes. You can use templates to pre-fill common values, add boilerplate text, and create a consistent structure for your tasks. Templates can also include variables, such as `{{title}}`, `{{date}}`, and `{{parentNote}}`, which will be automatically replaced with the appropriate values when a new task is created.

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
