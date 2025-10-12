# TaskNotes 4.0.0 Planning

**Status:** Planning Phase
**Target Release:** After Obsidian 1.10.0 GA (~1 month)
**Branch Strategy:** v3-maintenance (bug fixes only) | main (v4 development)

---

## Goals

### Primary Objectives
- **Simplify codebase**: Deprecate native views in favor of Bases views
- **Increase flexibility**: Leverage Bases plugin integration (1.10.0+)
- **Reduce maintenance burden**: Less custom code to maintain
- **Improve user experience**: More configurable, more powerful views

### Breaking Changes
- Deprecate native views: Task List, Agenda, Kanban, Advanced Calendar
- Remove "Notes" view entirely
- All views will use Bases architecture

### New Features
- OAuth integration with Google Calendar and Outlook (branch: issue-801-fix)
- Bases-powered views with enhanced customization
- TBD: Additional features to offset breaking changes

---

## Branching Strategy

### v3-maintenance Branch
- **Purpose**: Stable v3 releases with critical bug fixes only
- **No new features**
- **Created from**: main at v3.25.2
- **Release process**: Tag from v3-maintenance branch (e.g., `3.25.3`, `3.26.0`)

### main Branch (v4 Development)
- **Purpose**: All v4 development and new features
- **Breaking changes allowed**
- **Release process**:
  - Alpha releases: `4.0.0-alpha.1`, `4.0.0-alpha.2`, etc.
  - Beta releases: `4.0.0-beta.1`, etc.
  - Final: `4.0.0`

### Test Workflow
Update `.github/workflows/test.yml` to run on v3-maintenance branch:
```yaml
on:
  push:
    branches: [ main, develop, v3-maintenance ]
  pull_request:
    branches: [ main, develop, v3-maintenance ]
```

---

## Technical Investigation

### 1. Blocked/Blocking Functionality

**Current Implementation:**
- Custom properties for blocked/blocking tasks
- Requires lookups to other notes (dependency tracking)
- Not natively supported by Bases filter formulas

**Proposed Solution:**
Use custom view options + client-side filtering:

```typescript
// Example: Register view with custom options
this.registerBasesView('tasknotes-kanban', {
  name: "TaskNotes Kanban",
  icon: "layout-grid",
  factory: (controller, containerEl) => new TaskNotesKanbanView(controller),
  options: () => [
    {
      type: 'toggle',
      key: 'showBlocked',
      displayName: 'Show Blocked Tasks',
      default: true
    },
    {
      type: 'toggle',
      key: 'showBlockedBy',
      displayName: 'Show "Blocked By" Relationships',
      default: false
    }
  ]
});

// In view implementation:
class TaskNotesKanbanView extends BasesView {
  type = 'tasknotes-kanban';

  onDataUpdated(): void {
    const showBlocked = this.config.get('showBlocked');

    // Get all entries from Bases query
    let entries = this.data.data;

    // Apply client-side filtering for blocked/blocking
    if (!showBlocked) {
      entries = entries.filter(entry => {
        const blockedBy = entry.getValue('note.blockedBy');
        return !blockedBy || blockedBy.data.length === 0;
      });
    }

    // Could also compute blocking relationships by iterating
    // all entries and building a dependency map
    const dependencyMap = this.buildDependencyMap(this.data.data);

    this.render(entries, dependencyMap);
  }

  buildDependencyMap(entries: BasesEntry[]): Map<string, string[]> {
    const map = new Map();
    // Iterate all entries and build blocked/blocking relationships
    entries.forEach(entry => {
      const blockedBy = entry.getValue('note.blockedBy');
      if (blockedBy) {
        // Build map of dependencies
      }
    });
    return map;
  }
}
```

**Status:** ✅ Should work - needs verification

**Questions to Answer:**
- [ ] Can we access all entries in the base (not just filtered ones) to build dependency map?
- [ ] Performance implications of client-side filtering?
- [ ] Does `getValue('note.blockedBy')` work for custom list properties?

---

### 2. RRULE Recurrence Filtering

**Current Implementation:**
- Native views filter tasks based on recurrence rules (RRULE)
- Calculates occurrence dates dynamically
- Filters based on date range

**Proposed Solution A: Client-Side Filtering**
Similar to blocked/blocking approach:

```typescript
onDataUpdated(): void {
  let entries = this.data.data;

  // Filter for tasks within date range, accounting for recurrence
  entries = entries.filter(entry => {
    const rrule = entry.getValue('note.rrule');
    const startDate = entry.getValue('note.startDate');

    if (rrule) {
      // Parse RRULE and check if task occurs in visible date range
      return this.taskOccursInRange(rrule.data, startDate?.data, this.visibleRange);
    }

    return this.isInRange(startDate?.data, this.visibleRange);
  });

  this.render(entries);
}
```

**Proposed Solution B: Custom Formula**
Register a custom formula that Bases can use:

```typescript
// Hypothetical - need to verify if this is possible
this.registerBasesFormula('taskOccursInRange', {
  evaluate: (context: FormulaContext, startDate: DateValue, endDate: DateValue) => {
    const rrule = context.getValue('note.rrule');
    // ... calculate occurrences
    return new BooleanValue(occursInRange);
  }
});
```

**Status:** ⚠️ Needs investigation

**Questions to Answer:**
- [ ] Can we register custom formulas for Bases?
- [ ] If not, is client-side RRULE parsing performant enough?
- [ ] Do we need to keep native recurrence view?

---

### 3. Views Without Base Files

**Current Implementation:**
- Native views can be opened from command palette/ribbon
- Don't require a base file to exist
- Users can open "Task List" directly

**Challenge:**
- Bases views require a base file with query configuration
- Users would need to create base files first

**Proposed Solution A: Auto-Generate Base Files**
```typescript
async openTaskListView() {
  // Ensure default base file exists
  const baseFilePath = '.tasknotes/views/task-list.md';
  const baseFile = this.app.vault.getAbstractFileByPath(baseFilePath);

  if (!baseFile) {
    // Create default base file with TaskNotes query
    await this.app.vault.create(baseFilePath, `---
base:
  source: "/"
  query: "tags.includes([[task]])"
views:
  - type: tasknotes-list
    name: Task List
---`);
  }

  // Open the base file
  const leaf = this.app.workspace.getLeaf();
  await leaf.openFile(baseFile as TFile);
}
```

**Proposed Solution B: Register Native Commands That Open Bases**
```typescript
this.addCommand({
  id: 'open-task-list',
  name: 'Open Task List',
  callback: () => this.openDefaultBase('task-list')
});
```

**Status:** ⚠️ Needs testing

**Questions to Answer:**
- [ ] Can we auto-create base files in hidden folder?
- [ ] How do we handle user modifications to default bases?
- [ ] Is there a way to create a "virtual" base without a file?

---

### 4. Custom Formulas / Properties

**From API Documentation:**
- Bases supports formula properties: `formula.MyFormula`
- `FormulaContext` interface exists
- Legacy API shows `container.ctx.formulas`

**Status:** ⚠️ Unclear if plugins can register new formulas

**Questions to Answer:**
- [ ] Can plugins register custom formulas that appear in Bases?
- [ ] If yes, what's the API?
- [ ] If no, can we work around with view-level computation?

---

## Decisions Log

### Decision 1: Branching Strategy
**Date:** 2025-10-12
**Decision:** Use v3-maintenance for bug fixes, main for v4 development
**Rationale:** Allows parallel releases, clear separation of concerns, minimal workflow changes

### Decision 2: [Template]
**Date:** YYYY-MM-DD
**Decision:** What we decided
**Rationale:** Why we decided this
**Alternatives Considered:** What else we looked at

---

## Migration Path for Users

### Communication Strategy
1. Announce v4 plans in GitHub issue
2. Explain benefits of Bases-powered views
3. Provide migration guide
4. Offer alpha/beta testing period

### User Impact
- **Breaking:** Must create base files for views (or use auto-generated ones)
- **Breaking:** Some view configurations may not transfer
- **Benefit:** More flexible querying and filtering
- **Benefit:** Standardized Bases interface
- **Benefit:** Better performance (potentially)

### Migration Guide (Draft)
```markdown
# Migrating to TaskNotes 4.0

## What's Changed
TaskNotes 4.0 replaces native views with Bases-powered views for greater flexibility.

## Before Upgrading
1. Note your current view configurations
2. Export any custom filters/settings

## After Upgrading
1. TaskNotes will auto-create base files for standard views
2. Customize queries in base files instead of view settings
3. Use Obsidian's Bases filtering instead of TaskNotes filters

## Lost Functionality
- [TBD based on investigation]
```

---

## Testing Plan

### Phase 1: Proof of Concept
- [ ] Create simple Bases view with custom options
- [ ] Test blocked/blocking filtering approach
- [ ] Test RRULE filtering approach
- [ ] Verify custom formula registration (if possible)
- [ ] Test auto-generating base files

### Phase 2: Alpha Release
- [ ] Migrate one native view (e.g., Task List) to Bases
- [ ] Release alpha to small group of users
- [ ] Gather feedback on UX changes
- [ ] Benchmark performance

### Phase 3: Full Migration
- [ ] Migrate all remaining views
- [ ] Comprehensive testing
- [ ] Update documentation
- [ ] Beta release

### Phase 4: Release
- [ ] Final testing with Obsidian 1.10.0 GA
- [ ] Update plugin in Obsidian community store
- [ ] Announce release with migration guide

---

## Open Questions

1. **Performance**: Will client-side filtering of blocked/blocking relationships be fast enough for large vaults?
2. **Custom Formulas**: Can we register custom formulas, or do we need workarounds?
3. **View Discovery**: How do users discover and open Bases views? Command palette? Ribbon?
4. **Backward Compatibility**: Should we offer a "legacy mode" in v4.0.0 that keeps native views?
5. **Feature Parity**: What features from native views are we okay losing?

---

## Next Steps

1. ✅ Create v4-planning branch
2. ✅ Document initial planning decisions
3. [ ] Create proof-of-concept Bases view
4. [ ] Test blocked/blocking filtering approach
5. [ ] Test RRULE filtering approach
6. [ ] Verify custom formula capabilities
7. [ ] Make go/no-go decision on full migration vs. hybrid approach
8. [ ] Update project README with v4 roadmap

---

## Resources

- [Bases API Documentation](./BASES_API_DOCUMENTATION.md)
- [Obsidian Developer Docs](./obsidian-developer-docs/)
- [Issue #801: OAuth Integration](https://github.com/callumalpass/tasknotes/issues/801)
