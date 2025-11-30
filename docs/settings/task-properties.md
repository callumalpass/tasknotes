# Task Properties Settings

These settings allow you to define custom statuses, priorities, and user fields for your tasks.

[← Back to Settings](../settings.md)

!!! tip "Looking for property type documentation?"
    See the [Property Types Reference](property-types-reference.md) for detailed documentation on the expected data types (text, list, date, etc.) for each frontmatter property.

## Task Statuses

Customize the status options available for your tasks. These statuses control the task lifecycle and determine when tasks are considered complete.

- **Value**: The internal identifier stored in your task files (e.g., "in-progress").
- **Label**: The display name shown in the interface (e.g., "In Progress").
- **Color**: Visual indicator color for the status dot and badges.
- **Completed**: When checked, tasks with this status are considered finished and may be filtered differently.
- **Auto-archive**: When enabled, tasks will be automatically archived after the specified delay (1-1440 minutes).

### Boolean Status Values

TaskNotes supports using boolean values (`true` and `false`) as status values, which integrates with Obsidian's native checkbox property format:

- When you set a task's status to `"true"` or `"false"` (case-insensitive), TaskNotes automatically converts it to a boolean in frontmatter
- When reading tasks with boolean status values from frontmatter, they are converted back to the strings `"true"` or `"false"`
- This allows you to use Obsidian's native checkbox property toggles in the Properties panel while maintaining compatibility with TaskNotes

**Example:**
```yaml
---
status: true    # Boolean checkbox in Obsidian
---
```

This is useful for a simple binary task state that works with Obsidian's property editor.

## Task Priorities

Customize the priority levels available for your tasks.

- **Value**: The internal identifier stored in your task files (e.g., "high").
- **Display Label**: The display name shown in the interface (e.g., "High Priority").
- **Color**: Visual indicator color for the priority dot and badges.

> **Important for v4.0+ users:** Obsidian's Bases plugin sorts priorities alphabetically by their **Value**. To ensure priorities sort in your desired order, name your values to sort alphabetically in the order you want them to appear:
> - Example: `1-urgent`, `2-high`, `3-medium`, `4-normal`, `5-low`
> - Or: `a-urgent`, `b-high`, `c-medium`, `d-normal`, `e-low`

## Field Mapping

Configure which frontmatter properties TaskNotes should use for each field. TaskNotes will read AND write using these property names. Changing these after creating tasks may cause inconsistencies.

## Custom User Fields

Define custom frontmatter properties to appear as type-aware filter options across views. Each field has:

- **Display Name**: How the field appears in the UI
- **Property Key**: The frontmatter property name
- **Type**: Data type (text, number, boolean, date, or list)

### Autosuggestion Filters (Advanced)

Each custom field can optionally configure **autosuggestion filters** to control which files appear when using the `[[` wikilink autocomplete in that field.

![Custom Field Filtering](../assets/CustomFields-Selection-Filter.gif)

**Filter Options:**
- **Required tags**: Comma-separated list of tags (shows files with ANY of these tags)
- **Include folders**: Comma-separated list of folder paths (shows files in ANY of these folders)
- **Required property key**: Frontmatter property that must exist
- **Required property value**: Expected value for the property (optional)

**Visual Indicator:**
When filters are configured, a **"Filters On"** badge appears to remind you that suggestions are being filtered.

**See Also:** [User Fields Feature Documentation](../features/user-fields.md#file-suggestion-filtering-advanced) for detailed examples and configuration guide.
