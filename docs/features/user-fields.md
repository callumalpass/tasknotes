
# User Fields

TaskNotes allows you to define your own custom fields for tasks. This feature allows you to add custom data to your tasks and use it for filtering, sorting, and grouping.

[← Back to Features](../features.md)

## Creating User Fields

User fields are created in the TaskNotes settings, under the "Task Properties" tab. To create a new user field, click the "Add new user field" button.

Each user field has the following properties:

- **Display Name**: The name of the field as it will be displayed in the UI.
- **Property Name**: The name of the field as it will be stored in the frontmatter of the task note.
- **Type**: The data type of the field. The following types are supported:
    - **Text**: A single line of text.
    - **Number**: A numeric value (supports ranges in filters and sorting).
    - **Boolean**: A true/false value stored as a checkbox in the task modal.
    - **Date**: A date.
    - **List**: A list of values.
- **Default Value** (optional): A default value to pre-fill when creating new tasks. The input format depends on the field type:
    - **Text**: Enter the default text value.
    - **Number**: Enter the default number.
    - **Boolean**: Toggle to set the default state (checked/unchecked).
    - **Date**: Select from presets: None, Today, Tomorrow, or Next Week.
    - **List**: Enter comma-separated default values.

## File Suggestion Filtering (Advanced)

When using text or list type custom fields, you can configure **autosuggestion filters** to control which files appear in the autocomplete dropdown when you type `[[` in the field.

![Custom Field Filtering](../assets/CustomFields-Selection-Filter.gif)

This is useful when you want to limit suggestions to specific types of notes. For example:
- An "Assignee" field that only suggests notes tagged with `#person`
- A "Project" field that only shows notes in the `Projects/` folder
- A "Related Document" field filtered by a specific frontmatter property

### Configuring Filters

To configure filters for a custom field:

1. Go to **Settings → Task Properties → Custom User Fields**
2. Expand the custom field card you want to configure
3. Expand the **"Autosuggestion filters (Advanced)"** section
4. Configure one or more of the following filters:

#### Filter Options

- **Required tags**: Only show files that have ANY of these tags (comma-separated)
  - Example: `person, team` - shows files with either `#person` OR `#team` tag
  - Supports hierarchical tags: `project/active` matches `#project/active`

- **Include folders**: Only show files in these folders (comma-separated)
  - Example: `People/, Teams/` - shows files in either folder
  - Supports nested folders: `Projects/Active/` matches files in that specific folder

- **Required property key**: Only show files that have this frontmatter property
  - Example: `role` - shows files with a `role:` property in frontmatter

- **Required property value**: Expected value for the property (optional)
  - Example: `developer` - when combined with property key `role`, shows files with `role: developer`
  - Leave empty to match any value (just checks property exists)

#### Filter Indicator

When filters are configured, a **"Filters On"** badge with a funnel icon appears next to the section title. This prevents you from forgetting that filters are active.

### Filter Behavior

- **All filters are combined with AND logic**: Files must match ALL configured filters to appear
- **Empty filters are ignored**: If you don't configure a filter, it won't restrict results
- **No filters = all files**: If no filters are configured, all markdown files in your vault will appear
- **Filters only affect autocomplete**: They don't affect the actual field value or validation

### Example Configurations

#### Assignee Field (People Only)
```
Display Name: Assignee
Property Key: assignee
Type: List

Autosuggestion filters:
  Required tags: person
  Include folders: People/
```

#### Project Field (Active Projects)
```
Display Name: Project
Property Key: project
Type: Text

Autosuggestion filters:
  Required tags: project
  Required property key: status
  Required property value: active
```

#### Related Note (Specific Folder)
```
Display Name: Related Note
Property Key: related-note
Type: Text

Autosuggestion filters:
  Include folders: Documentation/, Guides/
```

## Using User Fields

Once you have created a user field, it will be available in the following places:

- **Task Modals**: The user field will be displayed in the task creation and edit modals.
- **Bases Filters**: Add the field to Bases filter expressions (for example `note.effort == "high"`) to narrow task lists and Kanban boards.
- **Sorting**: Use the Bases sort menu to order tasks by the user field.
- **Grouping**: Use the Bases group menu to create swimlanes or list groupings based on the user field.

## Frontmatter

User field data is stored in the frontmatter of the task note. The property name you define for the user field is used as the key in the frontmatter.

For example, if you create a user field with the property name "my_field", the data for that field will be stored in the frontmatter as follows:

```yaml
---
my_field: value
---
```
