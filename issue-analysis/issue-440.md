# Issue #440: Support Relative (Markdown) Links in Inline Replacement

## Problem Understanding

Currently, the TaskNotes plugin only replaces **wikilink-style** links (`[[task-202508181001]]`) with inline task previews in both Live Preview and Reading Mode. Users who prefer **markdown-style** links for better compatibility with other markdown tools cannot benefit from this feature.

The user wants to use markdown links like `[task-202508181001](../../../GTD/tasks/task-202508181001.md)` and have them replaced with inline task previews just like wikilinks are.

### User Context
- Using markdown-style links for greater compatibility with other Markdown tools
- Rendering Obsidian's Markdown files outside of Obsidian
- Wants inline task replacement to work with markdown links, not just wikilinks

### Current Behavior
- ✅ Wikilinks `[[task-name]]` are detected and replaced with inline task previews
- ❌ Markdown links `[text](path.md)` are **not** detected or replaced

### Expected Behavior
- ✅ Both wikilink and markdown link formats should be detected
- ✅ Both should be replaced with inline task previews
- ✅ Markdown link text should be used as display text (e.g., `[Buy groceries](task.md)` shows "Buy groceries")

## Test File Location

**Created Test:** `/tests/unit/issues/issue-440-markdown-link-inline-replacement.test.ts`

### Running the Test
```bash
npm test -- tests/unit/issues/issue-440-markdown-link-inline-replacement.test.ts
```

### Test Results
- ❌ 3 tests failing (as expected - demonstrating the missing feature)
- ✅ 4 tests passing (showing the detection service can find markdown links when configured properly)

The failing tests demonstrate:
1. Markdown links with relative paths are not replaced
2. Markdown link text is not used as display text
3. Mixed documents with both link types only replace wikilinks

## Relevant Code Locations

### 1. Link Detection Service
**File:** `src/services/TaskLinkDetectionService.ts`

- **Line 207-245:** `findWikilinks()` method - Currently finds both wikilinks AND markdown links
- **Line 126-157:** `parseMarkdownLink()` method - Already implemented! Parses markdown link syntax
- The service already supports finding markdown links and returns them with `type: 'markdown'`

### 2. Live Preview Overlay (Primary Fix Location)
**File:** `src/editor/TaskLinkOverlay.ts`

- **Line 167:** `findWikilinks()` is called (misleading name - actually finds both link types)
- **Line 198-203:** Link parsing logic - Only handles wikilinks (`type === 'wikilink'`)
- **Line 333-376:** `parseMarkdownLinkSync()` function - Already implemented but not used!

**Key Issue:** Lines 199-203 only process links with `type === 'wikilink'`, ignoring markdown links:
```typescript
const parsed =
    link.type === "wikilink"
        ? parseWikilinkSync(link.match)
        : parseMarkdownLinkSync(link.match);
```

This code exists but the condition at line 200 prevents markdown links from being processed in the decoration builder.

### 3. Reading Mode Processor
**File:** `src/editor/ReadingModeTaskLinkProcessor.ts`

- **Line 28-47:** Only processes links with class `internal-link` (wikilinks)
- **Line 39-46:** Has logic for external links but filters out markdown links to internal files
- This needs similar updates to support markdown links

### 4. Link Utilities (Already Complete)
**File:** `src/utils/linkUtils.ts`

- **Line 10-42:** `parseLinkToPath()` - Already handles both wikilink and markdown formats!
- **Line 23-37:** Markdown link parsing with URL decoding - Already implemented

## Proposed Solutions

### Solution 1: Minimal Fix - Process Markdown Links in Existing Flow (RECOMMENDED)

**Approach:** The infrastructure is already in place! Simply remove the filtering that prevents markdown links from being processed.

**Changes Required:**
1. **`src/editor/TaskLinkOverlay.ts:198-203`**
   - The code already handles both types with the ternary operator
   - No changes needed here - it already works!
   - The issue is likely earlier in the flow

2. **Investigation needed:** Check if there's filtering happening before line 198

**Pros:**
- Minimal code changes
- Leverages existing infrastructure (parseMarkdownLinkSync already exists)
- Low risk of breaking existing functionality
- Most of the code is already written

**Cons:**
- Need to verify all edge cases work correctly
- May need to update tests

**Estimated Complexity:** Low (1-2 hours)

### Solution 2: Unified Link Detection and Processing

**Approach:** Refactor to treat all links uniformly from the start, rather than having special cases.

**Changes Required:**
1. Create a unified `Link` interface that abstracts wikilink vs markdown
2. Update `findWikilinks()` to return unified link objects
3. Process all links the same way in decoration builder
4. Update both Live Preview and Reading Mode processors

**Pros:**
- Cleaner architecture
- Easier to add new link types in future
- More maintainable long-term

**Cons:**
- Larger refactor
- Higher risk of introducing bugs
- More testing required
- Breaks API if other code depends on current structure

**Estimated Complexity:** Medium-High (4-6 hours)

### Solution 3: Feature Flag Approach

**Approach:** Add a setting to enable/disable markdown link replacement, defaulting to enabled.

**Changes Required:**
1. Add `enableMarkdownLinkReplacement` to settings
2. Conditionally process markdown links based on setting
3. Add UI toggle in settings

**Pros:**
- Users can opt-in/opt-out
- Safer rollout
- Can be disabled if issues arise

**Cons:**
- Adds complexity for a feature that should "just work"
- More settings to maintain
- Most users would want this enabled anyway

**Estimated Complexity:** Medium (3-4 hours)

## Recommended Approach

**Solution 1: Minimal Fix** is recommended because:

1. **The infrastructure already exists** - `parseMarkdownLinkSync()`, `parseMarkdownLink()`, and markdown link detection are already implemented
2. **The code already tries to handle it** - Line 199-203 has the ternary operator to handle both types
3. **Low risk** - We're not changing the architecture, just ensuring markdown links flow through
4. **Quick win** - Can be implemented and tested quickly
5. **Matches user expectations** - Users expect both link types to work the same way

### Implementation Steps:

1. **Verify the actual blocker:** Run debugger to see where markdown links are filtered out
2. **Update Live Preview** (`TaskLinkOverlay.ts`):
   - Likely just need to ensure markdown links aren't filtered before line 198
   - The processing logic already exists!
3. **Update Reading Mode** (`ReadingModeTaskLinkProcessor.ts`):
   - Update `processLink()` to handle markdown links to internal files
   - Similar to Live Preview, the parsing utilities already exist
4. **Add tests** - Already created in issue-440-markdown-link-inline-replacement.test.ts
5. **Test edge cases:**
   - Relative paths (`../../../path.md`)
   - URL-encoded spaces (`task%20name.md`)
   - Mixed documents with both link types
   - Display text from markdown links

### Code Changes Preview:

**`src/editor/TaskLinkOverlay.ts`** - Likely already works, just needs verification:
```typescript
// Lines 198-203 already handle both types:
const parsed =
    link.type === "wikilink"
        ? parseWikilinkSync(link.match)
        : parseMarkdownLinkSync(link.match);
```

**Potential issue to investigate:** Check if there's early filtering in the detection service or elsewhere.

**`src/editor/ReadingModeTaskLinkProcessor.ts:39-46`** - Update to not filter markdown links:
```typescript
// Current code filters these out - need to process them instead
else if (
    href &&
    !href.startsWith("http://") &&
    !href.startsWith("https://") &&
    !href.includes("://")
) {
    // Process as potential internal markdown link
    this.processLink(linkEl, ctx.sourcePath, "markdown");
}
```

## Additional Considerations

### Performance
- Minimal impact expected since detection already finds both link types
- May need to ensure regex patterns are efficient for large documents

### Compatibility
- Should maintain backward compatibility
- No breaking changes to existing functionality
- Wikilink behavior remains unchanged

### User Experience
- Transparent to users - both link types "just work"
- Display text from markdown links enhances readability
- Maintains Obsidian's link resolution (handles relative paths correctly)

### Future Enhancements
- Could add setting to prefer markdown vs wikilink format in UI
- Could add command to convert between formats
- Could support other link formats (e.g., reference-style links)

## Testing Strategy

1. **Unit tests** - Already created, verify they pass after implementation
2. **Integration tests** - Test with real vault scenarios
3. **Edge cases:**
   - Empty display text `[](path.md)`
   - Links with fragments `[task](path.md#section)`
   - Links with query params (edge case)
   - Very long paths
4. **Performance testing** - Large documents with many links
5. **Cross-platform** - Test path resolution on Windows/Mac/Linux

## Success Criteria

- ✅ All tests in `issue-440-markdown-link-inline-replacement.test.ts` pass
- ✅ Existing wikilink tests continue to pass
- ✅ Markdown links with relative paths work
- ✅ Markdown links with absolute paths work
- ✅ Display text from markdown links is used correctly
- ✅ Mixed documents with both link types work
- ✅ Reading mode and Live Preview both support markdown links
- ✅ No performance regression
