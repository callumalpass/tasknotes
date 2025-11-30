# Property Types Reference

This reference documents the expected data types for each frontmatter property that TaskNotes uses.

[← Back to Settings](../settings.md)

## Quick Reference

| Property | Type | Example |
|----------|------|---------|
| title | text | `"My Task"` |
| status | text | `"open"`, `"in-progress"`, `"done"` |
| priority | text | `"low"`, `"normal"`, `"high"` |
| due | text (date) | `"2025-01-15"` |
| scheduled | text (date) | `"2025-01-10"` |
| completedDate | text (date) | `"2025-01-20"` |
| dateCreated | text (datetime) | `"2025-01-01T08:00:00Z"` |
| dateModified | text (datetime) | `"2025-01-15T10:30:00Z"` |
| tags | list | `["work", "urgent"]` |
| contexts | list | `["@office", "@home"]` |
| projects | list | `["[[Project A]]"]` |
| timeEstimate | number | `120` (minutes) |
| recurrence | text | `"FREQ=WEEKLY;BYDAY=MO"` |
| recurrence_anchor | text | `"scheduled"` or `"completion"` |
| timeEntries | list (objects) | See [Time Entries](#time-entries) |
| blockedBy | list (objects) | See [Dependencies](#dependencies-blockedby) |
| reminders | list (objects) | See [Reminders](#reminders) |
| complete_instances | list | `["2025-01-08", "2025-01-15"]` |
| skipped_instances | list | `["2025-01-22"]` |
| icsEventId | list | `["event-abc123"]` |

---

## Property Details

### Text Properties

#### title
- **Type:** text (string)
- **Description:** The task's title or name
- **Example:** `title: "Complete project documentation"`

#### status
- **Type:** text (string)
- **Description:** The task's current status. Must match one of the status values configured in your settings.
- **Default values:** `"open"`, `"in-progress"`, `"done"`
- **Example:** `status: "in-progress"`
- **Note:** Also supports boolean values (`true`/`false`) for Obsidian checkbox compatibility. See [Boolean Status Values](task-properties.md#boolean-status-values).

#### priority
- **Type:** text (string)
- **Description:** The task's priority level. Must match one of the priority values configured in your settings.
- **Default values:** `"low"`, `"normal"`, `"high"`
- **Example:** `priority: "high"`

---

### Date Properties

All date properties are stored as **text strings** in your frontmatter. TaskNotes expects specific formats:

#### due

- **Type:** text (date string)
- **Format:** `YYYY-MM-DD` or ISO 8601 timestamp
- **Description:** The task's due date
- **Examples:**

  ```yaml
  due: "2025-01-15"
  due: "2025-01-15T17:00:00"
  ```

#### scheduled

- **Type:** text (date string)
- **Format:** `YYYY-MM-DD` or ISO 8601 timestamp
- **Description:** When the task is scheduled to be worked on
- **Examples:**

  ```yaml
  scheduled: "2025-01-10"
  scheduled: "2025-01-10T09:00:00"
  ```

#### completedDate

- **Type:** text (date string)
- **Format:** `YYYY-MM-DD`
- **Description:** The date when the task was completed
- **Example:** `completedDate: "2025-01-20"`

#### dateCreated

- **Type:** text (datetime string)
- **Format:** ISO 8601 timestamp
- **Description:** When the task was created
- **Example:** `dateCreated: "2025-01-01T08:00:00Z"`

#### dateModified

- **Type:** text (datetime string)
- **Format:** ISO 8601 timestamp
- **Description:** When the task was last modified
- **Example:** `dateModified: "2025-01-15T10:30:00Z"`

---

### List Properties

List properties must be arrays, even when containing a single value.

#### tags

- **Type:** list (array of strings)
- **Description:** Tags associated with the task
- **Examples:**

  ```yaml
  tags: ["work", "documentation"]
  tags:
    - work
    - documentation
  ```

#### contexts

- **Type:** list (array of strings)
- **Description:** Context labels for the task
- **Examples:**

  ```yaml
  contexts: ["office", "computer"]
  contexts:
    - "office"
    - "computer"
  ```

#### projects

- **Type:** list (array of strings)
- **Description:** Project references (typically wiki-links)
- **Examples:**

  ```yaml
  projects: ["[[Website Redesign]]", "[[Q1 Planning]]"]
  projects:
    - "[[Website Redesign]]"
    - "[[Q1 Planning]]"
  ```

---

### Numeric Properties

#### timeEstimate
- **Type:** number
- **Unit:** minutes
- **Description:** Estimated time to complete the task
- **Example:** `timeEstimate: 120` (2 hours)

---

### Recurrence Properties

#### recurrence

- **Type:** text (string)
- **Format:** RFC 5545 RRULE format
- **Description:** Defines how the task repeats
- **Examples:**

  ```yaml
  recurrence: "FREQ=DAILY"
  recurrence: "FREQ=WEEKLY;BYDAY=MO,WE,FR"
  recurrence: "FREQ=MONTHLY;BYMONTHDAY=1"
  ```

#### recurrence_anchor

- **Type:** text (string)
- **Valid values:** `"scheduled"` or `"completion"`
- **Description:** Determines whether the next occurrence is calculated from the scheduled date or when the task was completed
- **Example:** `recurrence_anchor: "scheduled"`

#### complete_instances

- **Type:** list (array of date strings)
- **Format:** `YYYY-MM-DD`
- **Description:** Dates when recurring task instances were completed
- **Example:**

  ```yaml
  complete_instances:
    - "2025-01-08"
    - "2025-01-15"
  ```

#### skipped_instances

- **Type:** list (array of date strings)
- **Format:** `YYYY-MM-DD`
- **Description:** Dates when recurring task instances were skipped
- **Example:**

  ```yaml
  skipped_instances:
    - "2025-01-22"
  ```

---

### Complex Properties

These properties contain structured data with multiple fields.

#### Time Entries

- **Type:** list (array of objects)
- **Description:** Time tracking entries for the task
- **Structure:**

  ```yaml
  timeEntries:
    - startTime: "2025-01-15T10:30:00Z"    # Required: ISO 8601 timestamp
      endTime: "2025-01-15T11:15:00Z"      # Optional: ISO 8601 timestamp
      description: "Initial work"          # Optional: text
  ```

#### Dependencies (blockedBy)

- **Type:** list (array of objects)
- **Description:** Tasks that must be completed before this task can start
- **Structure:**

  ```yaml
  blockedBy:
    - uid: "path/to/blocking-task.md"    # Required: path to blocking task
      reltype: "FINISHTOSTART"           # Required: relationship type
      gap: "P1D"                         # Optional: ISO 8601 duration offset
  ```

- **Relationship types:** `FINISHTOSTART`, `STARTTOSTART`, `FINISHTOFINISH`, `STARTTOFINISH` 
	- Note: As of version 4.1.0, only the FINISHTOSTART duration offset is supported

#### Reminders

- **Type:** list (array of objects)
- **Description:** Reminder notifications for the task
- **Structure for relative reminders:**

  ```yaml
  reminders:
    - id: "rem_1"                        # Required: unique identifier
      type: "relative"                   # Required: "relative" or "absolute"
      relatedTo: "due"                   # Required for relative: "due" or "scheduled"
      offset: "-PT1H"                    # Required for relative: ISO 8601 duration
      description: "1 hour before due"   # Optional: description
  ```

- **Structure for absolute reminders:**

  ```yaml
  reminders:
    - id: "rem_2"
      type: "absolute"
      absoluteTime: "2025-01-15T09:00:00Z"  # Required for absolute: ISO 8601 timestamp
      description: "Morning reminder"
  ```

#### icsEventId

- **Type:** list (array of strings)
- **Description:** ICS calendar event IDs linked to this task
- **Example:**
  
  ```yaml
  icsEventId:
    - "event-abc123"
    - "event-def456"
  ```


---

## Complete Example

Here's a complete task with all property types:

```yaml
---
title: "Complete quarterly report"
status: "in-progress"
priority: "high"
due: "2025-01-31"
scheduled: "2025-01-25"
tags:
  - work
  - reports
contexts:
  - "@office"
projects:
  - "[[Q1 Planning]]"
timeEstimate: 240
dateCreated: "2025-01-01T08:00:00Z"
dateModified: "2025-01-20T14:30:00Z"
timeEntries:
  - startTime: "2025-01-20T10:00:00Z"
    endTime: "2025-01-20T11:30:00Z"
blockedBy:
  - uid: "tasks/gather-data.md"
    reltype: "FINISHTOSTART"
reminders:
  - id: "rem_1"
    type: "relative"
    relatedTo: "due"
    offset: "-P1D"
    description: "Due tomorrow"
---
```

---

## Field Mapping

All property names can be customized via **Settings → Task Properties → Field Mapping**. If you change a field mapping, TaskNotes will read and write using your custom property name.

For example, if you map `due` to `dueDate`, TaskNotes will expect:

```yaml
dueDate: "2025-01-15"
```

See [Field Mapping](task-properties.md#field-mapping) for configuration details.

---

## Custom User Fields

You can define additional properties with these types:

- **text** - Single text value
- **number** - Numeric value
- **date** - Date string (YYYY-MM-DD)
- **boolean** - true/false
- **list** - Array of values

See [Custom User Fields](task-properties.md#custom-user-fields) for configuration details.
