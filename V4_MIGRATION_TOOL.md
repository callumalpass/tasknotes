# TaskNotes v4 Migration Tool: Saved Views to Bases Conversion

**Status:** Design Document
**Created:** 2025-10-12
**Related:** V4_PLANNING.md

---

## Overview

This document outlines the strategy for converting TaskNotes v3 "saved views" to Bases-compatible base files for v4.0.

### Problem Statement

In v3, users can create "saved views" that store:
- Complex filter queries (nested AND/OR conditions)
- Sort configuration
- Grouping configuration
- View-specific options (e.g., showOverdueOnToday, showNotes)
- Visible properties for task cards

In v4, we're deprecating native views in favor of Bases. We need a migration tool that converts these saved views into base files that work with the Bases plugin.

---

## Current SavedView Structure

```typescript
interface SavedView {
  id: string;                           // Unique ID
  name: string;                         // User-defined name
  query: FilterQuery;                   // Nested filter structure
  viewOptions?: { [key: string]: boolean };  // View toggles
  visibleProperties?: string[];         // Property visibility
}

interface FilterQuery extends FilterGroup {
  sortKey?: TaskSortKey;
  sortDirection?: SortDirection;
  groupKey?: TaskGroupKey;
  subgroupKey?: TaskGroupKey;
}

interface FilterGroup {
  type: "group";
  id: string;
  conjunction: "and" | "or";
  children: FilterNode[];               // Conditions or nested groups
}

interface FilterCondition {
  type: "condition";
  id: string;
  property: FilterProperty;             // e.g., 'status', 'due', 'priority'
  operator: FilterOperator;             // e.g., 'is', 'contains', 'is-before'
  value: string | string[] | number | boolean | null;
}
```

---

## Target Bases File Format

```yaml
# Example base file format
filters:
  and:
    - 'tags.includes([[task]])'
    - or:
        - 'status == "open"'
        - 'status == "in-progress"'
    - 'due <= today()'

formulas:
  # Optional computed properties
  overdue: 'due && due < today() && !status.isCompleted'

properties:
  note.status:
    displayName: Status
  note.due:
    displayName: Due Date

views:
  - type: table
    name: "My Tasks"
    filters:
      # View-specific filters can be added here
    order:
      - note.priority
      - note.due
      - note.title
    sort:
      - property: note.priority
        direction: DESC
      - property: note.due
        direction: ASC
    groupBy: note.status
    # Custom view options can be stored here
    showCompleted: false
```

---

## Conversion Strategy

### Phase 1: Filter Conversion

**Challenge:** Convert TaskNotes filter structure to Bases filter syntax.

#### Property Mapping

TaskNotes properties need to be mapped to Bases property IDs:

| TaskNotes Property | Bases Property | Notes |
|--------------------|----------------|-------|
| `title` | `note.title` | Frontmatter property |
| `status` | `note.status` | Frontmatter property |
| `priority` | `note.priority` | Frontmatter property |
| `due` | `note.due` | Frontmatter property |
| `scheduled` | `note.scheduled` | Frontmatter property |
| `tags` | `file.tags` or `note.tags` | Use `file.tags` for tag checks |
| `contexts` | `note.contexts` | Frontmatter property |
| `projects` | `note.projects` | Frontmatter property |
| `archived` | `note.archived` | Frontmatter property |
| `file.ctime` | `file.ctime` | File property |
| `file.mtime` | `file.mtime` | File property |
| `path` | `file.path` | File property |
| `completedDate` | `note.completedDate` | Frontmatter property |
| `timeEstimate` | `note.timeEstimate` | Frontmatter property |
| `recurrence` | `note.recurrence` | Frontmatter property |
| `user:fieldName` | `note.fieldName` | User-defined frontmatter |

#### Operator Conversion

| TaskNotes Operator | Bases Expression | Example |
|--------------------|------------------|---------|
| `is` | `==` | `status == "open"` |
| `is-not` | `!=` | `status != "done"` |
| `contains` | `.includes()` or `.contains()` | `tags.includes("work")` |
| `does-not-contain` | `!...includes()` | `!tags.includes("archive")` |
| `is-before` | `<` | `due < today()` |
| `is-after` | `>` | `due > today()` |
| `is-on-or-before` | `<=` | `due <= today()` |
| `is-on-or-after` | `>=` | `due >= today()` |
| `is-empty` | `== null` or `!` | `!due` or `due == null` |
| `is-not-empty` | `!= null` | `due != null` |
| `is-checked` | `== true` | `archived == true` |
| `is-not-checked` | `== false` or `!` | `!archived` |
| `is-greater-than` | `>` | `timeEstimate > 60` |
| `is-less-than` | `<` | `timeEstimate < 30` |
| `is-greater-than-or-equal` | `>=` | `timeEstimate >= 60` |
| `is-less-than-or-equal` | `<=` | `timeEstimate <= 30` |

#### Special Cases

1. **Multiple Values (Array contains):**
   ```typescript
   // TaskNotes: status is ["open", "in-progress"]
   // Bases: status == "open" || status == "in-progress"
   ```

2. **Date Comparisons:**
   ```typescript
   // TaskNotes: due is-before "2025-12-31"
   // Bases: due < date("2025-12-31")
   ```

3. **Tag Checks:**
   ```typescript
   // TaskNotes: tags contains "work"
   // Bases: file.hasTag("work") or tags.includes("work")
   ```

4. **Link Properties (projects, contexts):**
   ```typescript
   // TaskNotes: projects contains "[[Project A]]"
   // Bases: projects.includes(link("Project A"))
   ```

5. **Blocked/Blocking Dependencies:**
   - **Cannot be converted** - Bases formulas can't query other notes
   - Add warning comment in generated base file
   - Potentially use formula placeholder for future implementation

### Phase 2: Sort & Group Conversion

#### Sort Conversion

```typescript
// TaskNotes
sortKey: "due"
sortDirection: "asc"

// Bases
sort:
  - property: note.due
    direction: ASC
```

#### Group Conversion

```typescript
// TaskNotes
groupKey: "status"
subgroupKey: "priority"

// Bases
groupBy: note.status
# Note: Bases may not support nested grouping in all views
# Subgrouping might need to be handled at view level
```

### Phase 3: View Options Conversion

View-specific options should be preserved in the view configuration:

```yaml
views:
  - type: table  # or tasknotes-list, tasknotes-kanban, etc.
    name: "My View"
    # Standard Bases options
    filters: ...
    order: ...
    sort: ...
    groupBy: ...

    # TaskNotes-specific options (custom view will read these)
    showOverdueOnToday: true
    showNotes: false
    showCompleted: false
```

### Phase 4: Visible Properties Conversion

```typescript
// TaskNotes
visibleProperties: ["due", "priority", "projects"]

// Bases
order:
  - note.due
  - note.priority
  - note.projects
```

---

## Implementation Plan

### 1. Create Migration Utility Class

```typescript
// src/migration/SavedViewConverter.ts

export class SavedViewConverter {
  constructor(
    private plugin: TaskNotesPlugin,
    private settings: TaskNotesSettings
  ) {}

  /**
   * Convert a saved view to a Bases-compatible base file
   */
  async convertToBaseFile(savedView: SavedView): Promise<string> {
    const baseConfig = {
      filters: this.convertFilters(savedView.query),
      formulas: this.generateFormulas(savedView),
      properties: this.generatePropertyConfig(savedView),
      views: [this.convertToView(savedView)]
    };

    return stringifyYaml(baseConfig);
  }

  /**
   * Convert FilterQuery to Bases filter syntax
   */
  private convertFilters(query: FilterQuery): any {
    return this.convertFilterNode(query);
  }

  /**
   * Recursively convert filter nodes
   */
  private convertFilterNode(node: FilterNode): any {
    if (node.type === 'condition') {
      return this.convertCondition(node);
    } else {
      // FilterGroup
      const conjunction = node.conjunction;
      const children = node.children.map(child =>
        this.convertFilterNode(child)
      );

      if (children.length === 0) {
        return null;
      }
      if (children.length === 1) {
        return children[0];
      }

      return {
        [conjunction]: children.filter(c => c !== null)
      };
    }
  }

  /**
   * Convert a single condition to Bases filter expression
   */
  private convertCondition(condition: FilterCondition): string | null {
    const property = this.mapProperty(condition.property);
    const operator = condition.operator;
    const value = condition.value;

    // Handle different operator types
    switch (operator) {
      case 'is':
        if (Array.isArray(value)) {
          // Multiple values: status is ["open", "in-progress"]
          const conditions = value.map(v =>
            `${property} == ${this.formatValue(v, condition.property)}`
          );
          return conditions.length === 1
            ? conditions[0]
            : null; // Return null, parent will handle with 'or'
        }
        return `${property} == ${this.formatValue(value, condition.property)}`;

      case 'is-not':
        if (Array.isArray(value)) {
          const conditions = value.map(v =>
            `${property} != ${this.formatValue(v, condition.property)}`
          );
          return conditions.length === 1
            ? conditions[0]
            : null; // Return null, parent will handle with 'and'
        }
        return `${property} != ${this.formatValue(value, condition.property)}`;

      case 'contains':
        if (this.isListProperty(condition.property)) {
          return `${property}.includes(${this.formatValue(value, condition.property)})`;
        }
        return `${property}.contains(${this.formatValue(value, condition.property)})`;

      case 'does-not-contain':
        if (this.isListProperty(condition.property)) {
          return `!${property}.includes(${this.formatValue(value, condition.property)})`;
        }
        return `!${property}.contains(${this.formatValue(value, condition.property)})`;

      case 'is-before':
        return `${property} < ${this.formatDateValue(value)}`;

      case 'is-after':
        return `${property} > ${this.formatDateValue(value)}`;

      case 'is-on-or-before':
        return `${property} <= ${this.formatDateValue(value)}`;

      case 'is-on-or-after':
        return `${property} >= ${this.formatDateValue(value)}`;

      case 'is-empty':
        return `!${property}`;

      case 'is-not-empty':
        return `${property}`;

      case 'is-checked':
        return `${property} == true`;

      case 'is-not-checked':
        return `${property} == false`;

      case 'is-greater-than':
        return `${property} > ${value}`;

      case 'is-less-than':
        return `${property} < ${value}`;

      case 'is-greater-than-or-equal':
        return `${property} >= ${value}`;

      case 'is-less-than-or-equal':
        return `${property} <= ${value}`;

      default:
        console.warn(`Unknown operator: ${operator}`);
        return null;
    }
  }

  /**
   * Map TaskNotes property to Bases property ID
   */
  private mapProperty(property: FilterProperty): string {
    const mapping: Record<string, string> = {
      'title': 'note.title',
      'status': 'note.status',
      'priority': 'note.priority',
      'due': 'note.due',
      'scheduled': 'note.scheduled',
      'tags': 'file.tags',
      'contexts': 'note.contexts',
      'projects': 'note.projects',
      'archived': 'note.archived',
      'file.ctime': 'file.ctime',
      'file.mtime': 'file.mtime',
      'path': 'file.path',
      'completedDate': 'note.completedDate',
      'timeEstimate': 'note.timeEstimate',
      'recurrence': 'note.recurrence',
      'status.isCompleted': 'note.status.isCompleted',
    };

    // Handle user-defined properties
    if (property.startsWith('user:')) {
      const fieldName = property.substring(5);
      return `note.${fieldName}`;
    }

    return mapping[property] || `note.${property}`;
  }

  /**
   * Format value based on property type
   */
  private formatValue(value: any, property: FilterProperty): string {
    if (value === null || value === undefined) {
      return 'null';
    }

    // String values need quotes
    if (typeof value === 'string') {
      // Check if it's a link property (projects, contexts)
      if (property === 'projects' || property === 'contexts') {
        // Handle links: "[[Project A]]" -> link("Project A")
        const linkMatch = value.match(/\[\[(.*?)\]\]/);
        if (linkMatch) {
          return `link("${linkMatch[1]}")`;
        }
      }

      // Check if it's a tag
      if (property === 'tags') {
        // Remove # if present
        const tag = value.startsWith('#') ? value.substring(1) : value;
        return `"${tag}"`;
      }

      return `"${value}"`;
    }

    // Numbers and booleans don't need quotes
    return String(value);
  }

  /**
   * Format date values
   */
  private formatDateValue(value: any): string {
    if (typeof value === 'string') {
      // Assume ISO date format
      return `date("${value}")`;
    }
    return 'today()';
  }

  /**
   * Check if property is a list/array type
   */
  private isListProperty(property: FilterProperty): boolean {
    return ['tags', 'contexts', 'projects', 'blockedBy', 'blocking'].includes(property);
  }

  /**
   * Generate formulas section (optional)
   */
  private generateFormulas(savedView: SavedView): Record<string, string> {
    // Future: Add computed properties here
    // For now, return empty
    return {};
  }

  /**
   * Generate properties configuration
   */
  private generatePropertyConfig(savedView: SavedView): any {
    const config: any = {};

    // Add display names for visible properties
    if (savedView.visibleProperties) {
      savedView.visibleProperties.forEach(prop => {
        const basesProperty = this.mapProperty(prop as FilterProperty);
        config[basesProperty] = {
          displayName: this.getDisplayName(prop)
        };
      });
    }

    return config;
  }

  /**
   * Get human-readable display name for property
   */
  private getDisplayName(property: string): string {
    const names: Record<string, string> = {
      'title': 'Title',
      'status': 'Status',
      'priority': 'Priority',
      'due': 'Due Date',
      'scheduled': 'Scheduled',
      'tags': 'Tags',
      'contexts': 'Contexts',
      'projects': 'Projects',
      'completedDate': 'Completed',
      'timeEstimate': 'Time Estimate',
    };

    return names[property] || property;
  }

  /**
   * Convert to view configuration
   */
  private convertToView(savedView: SavedView): any {
    const view: any = {
      type: 'table',  // Default to table, can be customized
      name: savedView.name,
    };

    // Add sort configuration
    if (savedView.query.sortKey) {
      view.sort = [{
        property: this.mapProperty(savedView.query.sortKey as FilterProperty),
        direction: savedView.query.sortDirection === 'asc' ? 'ASC' : 'DESC'
      }];
    }

    // Add groupBy configuration
    if (savedView.query.groupKey && savedView.query.groupKey !== 'none') {
      view.groupBy = this.mapProperty(savedView.query.groupKey as FilterProperty);
    }

    // Add visible properties as order
    if (savedView.visibleProperties && savedView.visibleProperties.length > 0) {
      view.order = savedView.visibleProperties.map(prop =>
        this.mapProperty(prop as FilterProperty)
      );
    }

    // Preserve view options
    if (savedView.viewOptions) {
      Object.assign(view, savedView.viewOptions);
    }

    return view;
  }
}
```

### 2. Create Migration Command

```typescript
// src/commands/MigrateSavedViewsCommand.ts

export class MigrateSavedViewsCommand {
  constructor(
    private plugin: TaskNotesPlugin,
    private converter: SavedViewConverter
  ) {}

  async execute(): Promise<void> {
    const savedViews = this.plugin.viewStateManager.getSavedViews();

    if (savedViews.length === 0) {
      new Notice('No saved views to migrate');
      return;
    }

    // Create folder for base files
    const baseFolder = '.tasknotes/bases';
    await this.ensureFolderExists(baseFolder);

    // Convert each saved view
    const results: { success: string[]; failed: string[] } = {
      success: [],
      failed: []
    };

    for (const view of savedViews) {
      try {
        const baseContent = await this.converter.convertToBaseFile(view);
        const fileName = this.sanitizeFileName(view.name);
        const filePath = `${baseFolder}/${fileName}.md`;

        // Write base file with frontmatter
        const content = `---\nbase:\n  source: "/"\n  query: 'tags.includes([[${this.plugin.settings.taskTag}]])'\n${baseContent}\n---\n`;

        await this.plugin.app.vault.create(filePath, content);
        results.success.push(view.name);
      } catch (error) {
        console.error(`Failed to migrate view "${view.name}":`, error);
        results.failed.push(view.name);
      }
    }

    // Show summary
    this.showMigrationSummary(results);
  }

  private async ensureFolderExists(path: string): Promise<void> {
    const folder = this.plugin.app.vault.getAbstractFileByPath(path);
    if (!folder) {
      await this.plugin.app.vault.createFolder(path);
    }
  }

  private sanitizeFileName(name: string): string {
    // Remove invalid characters and limit length
    return name
      .replace(/[\\/:*?"<>|]/g, '-')
      .replace(/\s+/g, '-')
      .toLowerCase()
      .substring(0, 50);
  }

  private showMigrationSummary(results: { success: string[]; failed: string[] }): void {
    const total = results.success.length + results.failed.length;
    let message = `Migration complete: ${results.success.length}/${total} views converted`;

    if (results.failed.length > 0) {
      message += `\n\nFailed views:\n${results.failed.join(', ')}`;
    }

    new Notice(message, 10000);
  }
}
```

### 3. Add Migration Modal

```typescript
// src/modals/MigrationModal.ts

export class MigrationModal extends Modal {
  constructor(
    app: App,
    private savedViews: SavedView[],
    private onConfirm: () => Promise<void>
  ) {
    super(app);
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();

    contentEl.createEl('h2', { text: 'Migrate Saved Views to Bases' });

    contentEl.createEl('p', {
      text: `This will convert ${this.savedViews.length} saved view(s) to Bases format.`
    });

    // Show list of views
    const list = contentEl.createEl('ul');
    this.savedViews.forEach(view => {
      list.createEl('li', { text: view.name });
    });

    // Warning about limitations
    const warning = contentEl.createDiv('callout callout-warning');
    warning.createEl('p', {
      text: '⚠️ Important Notes:'
    });
    const notes = warning.createEl('ul');
    notes.createEl('li', {
      text: 'Blocked/Blocking filters cannot be converted (Bases limitation)'
    });
    notes.createEl('li', {
      text: 'Some complex filters may need manual adjustment'
    });
    notes.createEl('li', {
      text: 'Base files will be created in .tasknotes/bases/'
    });
    notes.createEl('li', {
      text: 'Your original saved views will be preserved'
    });

    // Buttons
    const buttonContainer = contentEl.createDiv('modal-button-container');

    const cancelButton = buttonContainer.createEl('button', { text: 'Cancel' });
    cancelButton.addEventListener('click', () => this.close());

    const confirmButton = buttonContainer.createEl('button', {
      text: 'Migrate',
      cls: 'mod-cta'
    });
    confirmButton.addEventListener('click', async () => {
      await this.onConfirm();
      this.close();
    });
  }

  onClose(): void {
    const { contentEl } = this;
    contentEl.empty();
  }
}
```

### 4. Register Command in Plugin

```typescript
// In main.ts

async onload() {
  // ... existing code ...

  // Add migration command
  this.addCommand({
    id: 'migrate-saved-views-to-bases',
    name: 'Migrate Saved Views to Bases Format',
    callback: () => {
      const savedViews = this.viewStateManager.getSavedViews();

      if (savedViews.length === 0) {
        new Notice('No saved views to migrate');
        return;
      }

      const modal = new MigrationModal(
        this.app,
        savedViews,
        async () => {
          const converter = new SavedViewConverter(this, this.settings);
          const command = new MigrateSavedViewsCommand(this, converter);
          await command.execute();
        }
      );
      modal.open();
    }
  });
}
```

---

## User Experience

### Migration Flow

1. **User opens command palette**
2. **User selects "Migrate Saved Views to Bases Format"**
3. **Modal displays:**
   - List of saved views to convert
   - Warnings about limitations
   - Destination folder information
4. **User confirms migration**
5. **Plugin:**
   - Creates `.tasknotes/bases/` folder
   - Converts each saved view to a base file
   - Shows success/failure summary
6. **User can:**
   - Open base files in Obsidian
   - Customize filters/views further
   - Use Bases toolbar to switch between views

### Post-Migration

After migration, users should:
1. Review converted base files
2. Adjust any complex filters that need refinement
3. Set up commands/ribbons to open specific base files
4. Optionally delete old saved views (after confirming migration)

---

## Testing Plan

### Unit Tests

1. **Filter Conversion Tests:**
   - Single condition conversion
   - Nested AND/OR groups
   - All operator types
   - Edge cases (empty filters, null values)

2. **Property Mapping Tests:**
   - Standard properties
   - User-defined properties
   - File properties

3. **Value Formatting Tests:**
   - Strings, numbers, booleans
   - Dates
   - Links
   - Tags

### Integration Tests

1. **End-to-End Migration:**
   - Create test saved views
   - Run migration
   - Verify base files created
   - Verify YAML structure

2. **Bases Compatibility:**
   - Load generated base files in Obsidian
   - Verify filters work correctly
   - Verify sorting and grouping
   - Test with different view types

---

## Limitations & Future Enhancements

### Known Limitations

1. **Dependency Filters:**
   - Blocked/blocking filters cannot be converted
   - Bases formulas can't query other notes' properties
   - **Workaround:** Add comment in base file explaining limitation

2. **RRULE Filtering:**
   - Recurrence filtering may need special handling
   - Depends on whether Bases supports custom formulas for plugins

3. **Nested Subgrouping:**
   - Bases may not support nested grouping in all views
   - Secondary grouping might be lost

4. **View-Specific Options:**
   - Some TaskNotes-specific options may not apply to Bases views
   - Need to create custom Bases views to support these

### Future Enhancements

1. **Custom Formula Registration:**
   - Once Bases supports plugin formulas, implement:
     - Dependency checking formulas
     - RRULE occurrence checking
     - Custom date calculations

2. **Automatic Migration on Upgrade:**
   - Detect v3 → v4 upgrade
   - Offer to migrate saved views automatically

3. **Rollback Support:**
   - Option to convert base files back to saved views
   - Support downgrading from v4 to v3

4. **Import/Export:**
   - Export base files to share with other users
   - Import community-contributed bases

---

## Implementation Checklist

- [ ] Create `SavedViewConverter` class
- [ ] Implement filter conversion logic
- [ ] Implement property mapping
- [ ] Implement value formatting
- [ ] Create `MigrateSavedViewsCommand` class
- [ ] Create `MigrationModal` UI
- [ ] Register migration command
- [ ] Write unit tests for converter
- [ ] Write integration tests
- [ ] Test with real saved views
- [ ] Document migration process in user guide
- [ ] Add migration to v4 release notes

---

## References

- [V4 Planning Document](./V4_PLANNING.md)
- [Bases API Documentation](./BASES_API_DOCUMENTATION.md)
- [Bases Syntax Reference](./obsidian-help/en/Bases/Bases%20syntax.md)
- [SavedView Implementation](./src/services/ViewStateManager.ts)
- [Filter System](./src/types.ts)
