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
- **Release process** (using BRAT for testing):
  - Alpha releases: `4.0.0-alpha.1`, `4.0.0-alpha.2`, etc.
  - Beta releases: `4.0.0-beta.1`, `4.0.0-beta.2`, etc.
  - Final: `4.0.1` or `4.1.0` (NOT `4.0.0` - see BRAT gotcha below)

### BRAT Beta Testing Guidelines

**Version Naming Best Practices** (from [BRAT Developer Guide](https://github.com/TfTHacker/obsidian42-brat/blob/main/BRAT-DEVELOPER-GUIDE.md)):
- Follow semantic versioning: `MAJOR.MINOR.PATCH-prerelease.number`
- Tag, release name, and `manifest.json` version must match exactly
- Use formats: `4.0.0-alpha.1`, `4.0.0-beta.1`, `4.0.0-rc.1`, etc.

**⚠️ Critical Gotcha**:
Obsidian won't auto-update from pre-release to stable release with same minor version!
- If users install `4.0.0-beta.5`
- They won't auto-update to `4.0.0`
- They will auto-update to `4.0.1` or `4.1.0`

**Recommended Strategy**:
```
4.0.0-alpha.1  → Early testing
4.0.0-alpha.2  → ...
4.0.0-beta.1   → Feature complete, testing
4.0.0-beta.2   → ...
4.0.1          → First stable v4 release (skipping 4.0.0)
```

This ensures BRAT users automatically get the stable release.

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

## PR and Commit Strategy

### For Solo Development (Your Direct Work)

**v4 Development (main branch):**
- Commit directly to `main` for most work
- No PR needed - you're the maintainer
- Use conventional commits: `feat:`, `fix:`, `refactor:`, `docs:`
- Push frequently to keep branch up-to-date

**v3 Bug Fixes (v3-maintenance branch):**
- Commit directly to `v3-maintenance` for bug fixes
- No PR needed for your own fixes
- Tag and release immediately after fix
- **Do NOT cherry-pick to main** - codebases will diverge too much

**When to Use PRs (Your Own Work):**
- Large architectural changes you want documented
- Changes you want to think about before merging
- Optional: Create PR for your own review/documentation

### For External Contributors

**Bug Fixes:**
```markdown
Please submit PRs to:
- `v3-maintenance` - for bugs in current release (v3.x)
- `main` - for bugs that also exist in v4 (during alpha/beta)

We will NOT backport v4 features to v3.
```

**New Features:**
```markdown
Please submit PRs to:
- `main` only - all new features target v4

v3 is in maintenance mode (bug fixes only).
```

### Example Workflows

**Scenario 1: You find a bug in v3**
```bash
git checkout v3-maintenance
git pull origin v3-maintenance

# Fix bug
git add .
git commit -m "fix: resolve crash when opening calendar view"

# Update version in manifest.json to 3.25.3
git add manifest.json
git commit -m "chore: bump version to 3.25.3"

# Create tag and push
git tag 3.25.3
git push origin v3-maintenance
git push origin 3.25.3

# GitHub Actions will build and create draft release
```

**Scenario 2: You're working on v4 features**
```bash
git checkout main
git pull origin main

# Work on features
git add .
git commit -m "feat: add TaskNotes kanban view with Bases integration"

git push origin main

# Continue working, commit frequently
# No need for PRs unless you want them
```

**Scenario 3: External contributor submits PR**
```markdown
Contributor opens PR targeting `main` with a bug fix.

You review and either:
1. Merge to main
2. Ask them to retarget to v3-maintenance (if critical bug)
3. Manually apply fix to v3-maintenance yourself if urgent
```

**Scenario 4: Bug exists in BOTH v3 and v4 (rare)**
```bash
# If codebases haven't diverged much yet:
git checkout v3-maintenance
# Fix bug
git commit -m "fix: issue with date parsing"
git tag 3.25.3
git push origin v3-maintenance --follow-tags

# Then manually apply similar fix to v4
git checkout main
# Apply fix (likely different code, so manual)
git commit -m "fix: issue with date parsing"
git push origin main
```

### Branch Protection (Optional)

Consider enabling branch protection on both branches:
- Require status checks to pass (CI tests)
- DO NOT require PRs for your own work (too much overhead for solo dev)
- DO require PRs for external contributors

### Communication

Update your CONTRIBUTING.md to clarify:
```markdown
# Contributing to TaskNotes

## Branch Strategy

- `main` - v4 development (breaking changes allowed)
- `v3-maintenance` - v3 bug fixes only (no new features)

## Where to Submit PRs

### Bug Fixes
- If bug affects current release (v3.x): PR to `v3-maintenance`
- If bug affects v4 alpha/beta: PR to `main`

### New Features
- Always PR to `main` (v3 is in maintenance mode)

## Version Support

- v3.x: Bug fixes only until v4 stable release
- v4.x: Active development
```

---

## Technical Investigation

### 1. Blocked/Blocking Functionality

**Current Implementation:**
- Custom properties for blocked/blocking tasks
- Requires lookups to other notes (dependency tracking)
- Not natively supported by Bases filter formulas

**Decision: DEFER TO FUTURE VERSION**

We will NOT implement dependency filtering in v4.0.

**Rationale:**
- Bases formulas **cannot** query properties from other notes (confirmed from docs)
- Obsidian docs state: _"In the future, plugins will be able to add functions for use in formulas"_
- Client-side workarounds would be complex, temporary, and harder to maintain
- Better to wait for proper API support

**When Obsidian Adds Plugin Formula Support:**
We can implement clean, declarative dependency filtering:
```typescript
// Future: Register custom formula function
registerBasesFormula('hasIncompleteBlocker', (context) => {
  const blockedBy = context.getValue('note.blockedBy');
  // Query each blocking task and check status
  return blockedBy.some(task => getTaskStatus(task) !== 'complete');
});

// Then use in base filters:
filters:
  - 'formula.hasIncompleteBlocker == true'
```

**Status:** ⏸️ **DEFERRED - Waiting for Obsidian plugin formula API**

**Impact:**
- v4.0 will NOT support blocked/blocking relationship filtering
- Users who need dependency features should stay on v3.x
- Will add dependency support in v4.x when API available

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

### Decision 2: Defer Dependency Support Until Bases API Enhancement
**Date:** 2025-10-12
**Decision:** Do NOT implement client-side dependency filtering in v4. Wait for Obsidian to add plugin formula functions.
**Rationale:**
- Obsidian docs state: "In the future, plugins will be able to add functions for use in formulas"
- Client-side dependency filtering would be:
  - Complex to implement and maintain
  - A workaround for something that will be properly supported
  - Less performant than formula-based filtering
  - Harder for users to configure
- Better to wait for proper API support and implement it right

**Alternatives Considered:**
- Client-side filtering in `onDataUpdated()` - rejected as too complex/temporary
- Hybrid approach keeping native dependency views - rejected to reduce maintenance burden

**Impact:**
- v4 will NOT support blocked/blocking relationship filtering initially
- Users who rely on dependency features should stay on v3
- Once Obsidian adds plugin formula support, we can implement via custom formulas

### Decision 3: [Template]
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

## ⚠️ Important: Feature Removed
**Blocked/Blocking (Dependency) Filtering is NOT available in v4.0**

If you use dependency tracking features, **stay on v3.x** until:
1. Obsidian adds plugin formula function support
2. TaskNotes implements dependency filtering via custom formulas (v4.x)

## Before Upgrading
1. Check if you use blocked/blocking task filtering
   - If YES: Stay on v3.x for now
   - If NO: Safe to upgrade
2. Note your current view configurations
3. Export any custom filters/settings

## After Upgrading
1. TaskNotes will auto-create base files for standard views
2. Customize queries in base files instead of view settings
3. Use Obsidian's Bases filtering instead of TaskNotes filters

## Feature Comparison

| Feature | v3.x | v4.0 | Future (v4.x) |
|---------|------|------|---------------|
| Task List | ✅ Native | ✅ Bases | ✅ Bases |
| Kanban | ✅ Native | ✅ Bases | ✅ Bases |
| Calendar | ✅ Native | ✅ Bases | ✅ Bases |
| Agenda | ✅ Native | ✅ Bases | ✅ Bases |
| Dependency Filtering | ✅ | ❌ | ✅ (when API available) |
| Recurrence (RRULE) | ✅ | ⚠️ Limited | ✅ |
| OAuth Calendars | ❌ | ✅ | ✅ |
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
