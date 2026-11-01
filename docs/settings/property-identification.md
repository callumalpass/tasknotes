# Property-based Task Identification

When you choose to identify task files by a frontmatter property (instead of a tag), TaskNotes will match notes whose frontmatter property equals the configured value.

If you leave the value empty, TaskNotes matches every note that has the property, whatever its value. A property with an empty value, such as `status:`, still counts. This is the same rule as `file.hasProperty()` in Bases and `exists: true` in a generated mdbase type.

## Boolean values
- Enter the setting value as true or false (without quotes) in the settings UI.
- Obsidian stores checkbox properties as real booleans, not strings. The plugin compares booleans correctly:
  - "true" in settings matches frontmatter boolean true
  - "false" in settings matches frontmatter boolean false
  - Arrays are supported (e.g., property: [false, true])

Tip: You don’t need to quote boolean values in frontmatter. Use plain true/false to keep Obsidian’s property types consistent.

## Examples
- Setting: Property Name = isTask, Property Value = true
  - Matches: `isTask: true`
  - Does not match: `isTask: false`
- Setting: Property Name = isTask, Property Value = false
  - Matches: `isTask: false`
  - Does not match: `isTask: true`
- Setting: Property Name = status, Property Value = (empty)
  - Matches: `status: open`, `status: done`, `status:`
  - Does not match: a note without a `status` property

For related configuration details, see [Task Properties](task-properties.md).
