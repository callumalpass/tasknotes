# Issue #827 Analysis: Project Links Are No Longer Wiki Links (Regression)

## Problem Understanding

### Summary
After commit `918297a` (released in v3.24.4), TaskNotes started creating project links using markdown format `[text](path)` instead of wikilink format `[[link]]` for users who have markdown links enabled in their Obsidian settings. This is a regression that breaks project functionality because **Obsidian does not support markdown links in frontmatter properties** - they are not rendered as clickable links and don't work properly for grouping/filtering.

### Root Cause
The refactor in commit `918297a` introduced centralized link utilities (`linkUtils.ts`) that use Obsidian's native `app.fileManager.generateMarkdownLink()` API. This API **respects user preferences** for link format (wikilink vs markdown). While this is normally desirable for links in document content, it's problematic for frontmatter properties where only wikilinks are supported.

### Impact
- Users with markdown link format enabled in Obsidian settings get broken project links
- Project properties show non-clickable text instead of links
- Project grouping and filtering may be affected
- Affects all project link creation: task modals, context menus, inline task creation, subtask relationships

### Related Issues/PRs
- Introduced in: commit `918297a` (refactor: improve link handling with Obsidian API)
- Released in: v3.24.4
- Related PR: #805 (this PR added markdown link _parsing_ support, but the regression was caused by subsequent link _generation_ changes)

## Test File Location

**Test file:** `/home/calluma/projects/tasknotes/tests/unit/utils/linkUtils.test.ts`

**How to run:**
```bash
npm test -- tests/unit/utils/linkUtils.test.ts
```

**Current status:** Tests are created but will fail because:
1. The mock in `tests/__mocks__/obsidian.ts` needs to be updated (currently returns async/wrong signature)
2. The actual bug needs to be fixed in `linkUtils.ts`

**Note:** The test currently fails due to mock issues (returns `{}` instead of string). The mock's `generateMarkdownLink` method needs to be fixed to match the real Obsidian API signature (synchronous, not async).

## Relevant Code Locations

### Primary Functions (require changes)

1. **`src/utils/linkUtils.ts:55-68`** - `generateLink()` function
   - Currently calls `app.fileManager.generateMarkdownLink()` which respects user settings
   - This is the core function used throughout the codebase for project links

2. **`src/utils/linkUtils.ts:79-90`** - `generateLinkWithBasename()` function
   - Wraps `generateLink()` with basename as alias

3. **`src/utils/linkUtils.ts:102-114`** - `generateLinkWithDisplay()` function
   - Wraps `generateLink()` with custom display name

### Usage Locations (callers that create project links)

4. **`src/modals/TaskModal.ts:1386-1388`** - `buildProjectReference()` method
   - Used when collecting projects from selected project files
   - Called from `collectProjects()` at line 1381

5. **`src/modals/TaskCreationModal.ts:1153`** - Adding subtask relations
   - Creates project reference when adding subtasks to a task

6. **`src/modals/TaskEditModal.ts:1042`** - `addSubtaskRelation()` method
   - Creates project reference when adding a subtask

7. **`src/modals/TaskEditModal.ts:1066`** - `removeSubtaskRelation()` method
   - Creates project reference for comparison when removing subtask

8. **`src/components/TaskContextMenu.ts:972`** - `buildProjectReference()` method
   - Used in context menu operations for assigning/removing projects

9. **`src/editor/ProjectNoteDecorations.ts`** - Project note decorations
   - Uses `generateLink()` for creating subtask links (line references from commit 918297a)

10. **`src/main.ts:2295-2297`** - Inline task creation with parent note as project
    - Creates markdown link for current file as project

### Supporting Code

11. **`src/utils/linkUtils.ts:10-42`** - `parseLinkToPath()` function
    - Parses both wikilink and markdown link formats (this works correctly)
    - Added in PR #805 to support _reading_ markdown links

12. **`src/utils/dependencyUtils.ts`** - Uses link utilities for dependency formatting
    - May also be affected if dependencies are stored in frontmatter

## Proposed Solutions

### Solution 1: Force Wikilinks for Frontmatter Properties (Recommended)

**Description:** Create a new function `generateWikilink()` that always generates wikilink format, and update all frontmatter-related code to use it instead of `generateLink()`.

**Implementation:**
```typescript
// In src/utils/linkUtils.ts
export function generateWikilink(
    app: App,
    targetFile: TFile,
    sourcePath: string,
    subpath?: string,
    alias?: string
): string {
    // Always generate wikilink format for frontmatter compatibility
    const linktext = app.metadataCache.fileToLinktext(targetFile, sourcePath, true);
    let link = `[[${linktext}`;

    if (subpath) {
        link += subpath;
    }

    if (alias) {
        link += `|${alias}`;
    }

    link += ']]';
    return link;
}

// Update existing functions to use generateWikilink for frontmatter
export function generateLink(...) {
    // Keep current behavior for backward compatibility with non-frontmatter uses
    return generateWikilink(app, targetFile, sourcePath, subpath, alias);
}
```

**Files to modify:**
- `src/utils/linkUtils.ts` - Add `generateWikilink()` function, update existing functions
- Update all callers to use `generateWikilink()` (or keep as-is if we make it the default)
- `tests/__mocks__/obsidian.ts` - Fix mock signature (remove async, add parameters)
- `tests/unit/utils/linkUtils.test.ts` - Verify tests pass

**Pros:**
- ✅ Simple, focused fix that addresses the root cause
- ✅ Clear intent: wikilinks for frontmatter properties
- ✅ Maintains backward compatibility
- ✅ Works for all users regardless of Obsidian settings
- ✅ Minimal code changes required
- ✅ Aligns with Obsidian's documented frontmatter behavior

**Cons:**
- ❌ Doesn't allow markdown links in frontmatter (but this is an Obsidian limitation, not a bug)
- ❌ Users who want markdown links everywhere won't get them in properties

**Estimated effort:** 1-2 hours

---

### Solution 2: Add Configuration Setting for Link Format

**Description:** Add a plugin setting that allows users to choose between wikilinks and markdown links for project/dependency properties, defaulting to wikilinks.

**Implementation:**
```typescript
// In settings
interface Settings {
    ...
    useFrontmatterMarkdownLinks: boolean; // default: false
}

// In linkUtils.ts
export function generateLink(
    app: App,
    targetFile: TFile,
    sourcePath: string,
    subpath?: string,
    alias?: string,
    forceWikilink?: boolean
): string {
    const useWikilink = forceWikilink || !plugin.settings.useFrontmatterMarkdownLinks;

    if (useWikilink) {
        // Generate wikilink
        ...
    } else {
        // Use Obsidian API (respects user prefs)
        return app.fileManager.generateMarkdownLink(targetFile, sourcePath, subpath, alias);
    }
}
```

**Pros:**
- ✅ Gives users control and flexibility
- ✅ Supports users who have the frontmatter-markdown-links plugin installed
- ✅ Future-proof if Obsidian adds native markdown link support in frontmatter

**Cons:**
- ❌ More complex implementation
- ❌ Requires settings UI changes
- ❌ Default behavior (wikilinks) still needed to avoid breaking basic functionality
- ❌ May confuse users who don't understand Obsidian's frontmatter limitations
- ❌ Adds maintenance burden for a feature most users won't need

**Estimated effort:** 3-4 hours

---

### Solution 3: Hybrid Approach - Detect Context

**Description:** Automatically detect whether a link is being created for frontmatter vs document content, and use appropriate format.

**Implementation:**
```typescript
export function generateLink(
    app: App,
    targetFile: TFile,
    sourcePath: string,
    subpath?: string,
    alias?: string,
    context?: 'frontmatter' | 'content'
): string {
    // For frontmatter, always use wikilinks (Obsidian limitation)
    if (context === 'frontmatter') {
        return generateWikilink(app, targetFile, sourcePath, subpath, alias);
    }

    // For document content, respect user settings
    return app.fileManager.generateMarkdownLink(targetFile, sourcePath, subpath, alias);
}
```

**Pros:**
- ✅ Best of both worlds - wikilinks in frontmatter, user preference in content
- ✅ Respects Obsidian's limitations while honoring user preferences where possible
- ✅ No settings needed - automatic/smart

**Cons:**
- ❌ Requires updating all call sites to specify context
- ❌ Risk of missing call sites or specifying wrong context
- ❌ More complex API surface
- ❌ Currently all known uses are for frontmatter, so the complexity isn't justified

**Estimated effort:** 2-3 hours

---

## Recommended Approach

**Solution 1: Force Wikilinks for Frontmatter Properties**

### Justification

1. **Correctness:** Wikilinks are the only format that works reliably in Obsidian frontmatter properties. This is documented behavior, not a limitation we can work around.

2. **Simplicity:** The fix is straightforward and focused on the actual problem. We're not adding complexity for edge cases that may never be needed.

3. **User Experience:** The maintainer already acknowledged in the issue that wikilinks should be the default, with markdown links being an optional enhancement for users who have the `obsidian-frontmatter-markdown-links` plugin.

4. **Backward Compatibility:** By fixing `generateLink()` to always produce wikilinks, we ensure all existing and future uses are correct by default.

5. **Future Extensibility:** If we later want to support markdown links (Solution 2), we can add that as an opt-in feature on top of the working wikilink foundation.

### Implementation Plan

1. Update `linkUtils.ts`:
   - Modify `generateLink()` to always generate wikilinks
   - Update helper functions accordingly
   - Add comprehensive JSDoc explaining why wikilinks are required

2. Fix test infrastructure:
   - Update `tests/__mocks__/obsidian.ts` mock to match real API signature
   - Ensure existing tests pass

3. Run existing tests:
   - Verify no regressions in project/dependency handling
   - Check related tests: `TaskCreationModal.projects-with-commas.test.ts`, etc.

4. Manual testing:
   - Test with various scenarios: creating tasks, adding projects, subtask relationships
   - Verify links in frontmatter are clickable and work correctly

### Future Enhancement (Optional)

After the fix is stable, if there's user demand, implement Solution 2 to add an opt-in setting for markdown links in frontmatter for users who have the `obsidian-frontmatter-markdown-links` plugin. This would be behind a setting that:
- Defaults to `false` (wikilinks)
- Warns users it requires a third-party plugin
- Only affects frontmatter link generation

This keeps the fix simple now while leaving the door open for enhancement later.

---

# Issue #829 Analysis: Time Estimate Gets Lost in Instant Task Conversion

See [issue-analysis/issue-829.md](./issue-analysis/issue-829.md) for full details.
