# Defaults & Templates Settings

!!! note "Settings Reorganization"
    Default value settings have been moved to the [Task Properties](task-properties.md) tab. Each property card now contains its own default value configuration alongside other property-specific settings.

[← Back to Settings](../settings.md)

## Where to Find Default Settings

Default values for task properties are now configured within each property's card in the **Task Properties** tab:

| Setting | Location |
|---------|----------|
| Default status | Task Properties → Status card |
| Default priority | Task Properties → Priority card |
| Default due date | Task Properties → Due Date card |
| Default scheduled date | Task Properties → Scheduled Date card |
| Default contexts | Task Properties → Contexts card |
| Default tags | Task Properties → Tags card |
| Default projects | Task Properties → Projects card |
| Default time estimate | Task Properties → Time Estimate card |
| Default recurrence | Task Properties → Recurrence card |
| Default reminders | Task Properties → Reminders card |

## Body Template

Body template settings are in the **Features** tab:

- **Use body template**: Use a template file for task body content.
- **Body template file**: Path to template file for task body content. Supports template variables like `{{title}}`, `{{date}}`, `{{time}}`, `{{priority}}`, `{{status}}`, etc.

## Instant Task Conversion

Instant task conversion settings are in the **Features** tab:

- **Use task defaults on instant convert**: Apply default task settings when converting text to tasks instantly.

## Related Documentation

- [Task Properties Settings](task-properties.md) - Configure property keys, defaults, and NLP triggers
- [Task Defaults](task-defaults.md) - Folder management, filename templates, and archive settings
- [General Settings](general.md) - Task identification and storage settings
- [Features Settings](features.md) - Inline tasks and conversion settings
