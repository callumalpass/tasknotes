## Boolean property identification: contributor notes

This plugin supports using a frontmatter property to identify task notes. When the setting "Identify Properties by" is set to Property, and you configure a Task Property Name/Value pair, the plugin will match notes whose frontmatter property equals the configured value.

### Booleans vs strings in Obsidian frontmatter
- Obsidian stores checkbox properties as actual boolean values (true/false), not strings.
- The settings UI stores the Task Property Value as a string (e.g., "true" or "false").
- To avoid breaking native behavior, the plugin performs boolean-aware comparisons:
  - String "true" matches frontmatter boolean true
  - String "false" matches frontmatter boolean false
  - Case-insensitive for boolean strings
  - Arrays are supported (e.g., property: [false, true])

### Writing frontmatter on task creation
- When property-based identification is enabled, TaskService writes the Task Property Name to frontmatter.
- If Task Property Value equals "true" or "false", the plugin writes a real boolean (true/false) to frontmatter to keep consistency with Obsidian property types.

### Practical guidance for contributors
- Do not quote boolean values in frontmatter just to satisfy identification; the comparison logic handles booleans.
- When touching identification logic, preserve:
  - Strict equality for non-boolean values
  - Case-insensitive handling for "true"/"false"
  - Array handling via some(...) semantics
- Keep the minimal, non-disruptive approach: no heavy parsers or global state stores.

### Tests
- Unit tests cover boolean identification in MinimalNativeCache and boolean writing in TaskService.
- See:
  - tests/unit/utils/MinimalNativeCache.boolean-property.test.ts
  - tests/unit/services/TaskService.test.ts (coercion tests for true/false)

### Limitations
- Only boolean coercion is applied. Other types (numbers, links) still use strict equality or existing mapping utilities.

If you extend identification to additional types, add tests and document the comparison rules here to keep behavior predictable and compatible with Obsidian’s native property types.
