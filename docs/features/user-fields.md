
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

## Using User Fields

Once you have created a user field, it will be available in the following places:

- **Task Modals**: The user field will be displayed as a field in the task creation and edit modals.
- **Filtering**: You can filter your tasks by the user field in the FilterBar.
- **Sorting**: You can sort your tasks by the user field.
- **Grouping**: You can group your tasks by the user field.

## Frontmatter

User field data is stored in the frontmatter of the task note. The property name you define for the user field is used as the key in the frontmatter.

For example, if you create a user field with the property name "my_field", the data for that field will be stored in the frontmatter as follows:

```yaml
---
my_field: value
---
```
