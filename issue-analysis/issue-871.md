# Issue #871: Drag and Drop in Kanban for Bases Changes Wrong Property

## Problem Understanding

### Issue Summary
When using Bases Kanban view with a custom `groupBy` configuration (e.g., grouping by priority, projects, or custom fields), dragging a task between columns incorrectly updates the TaskNotes **status** property instead of updating the property specified in the `groupBy` configuration.

### Expected Behavior
- User configures Bases view with Kanban layout, grouped by `priority`
- User drags a task from "low" priority column to "high" priority column
- Task's `priority` property should be updated to "high"

### Actual Behavior
- User configures Bases view with Kanban layout, grouped by `priority`
- User drags a task from "low" priority column to "high" priority column
- Task's **status** property is incorrectly updated to "high" instead of the `priority` property
- The task doesn't move to the correct column on refresh

### Root Cause
The bug occurs when `groupByPropertyId` cannot be determined and is `null`. This happens in two scenarios:

1. **Config retrieval fails**: The code attempts to get the groupBy config from `viewContext.config.getAsPropertyId("groupBy")` but may fail
2. **Inference is incomplete**: The code tries to infer the groupBy property by examining group values (lines 172-198 in `src/bases/kanban-view.ts`), but only infers for status and priority values. For custom fields, projects, contexts, or any other grouping, it leaves `groupByPropertyId` as `null`

When `groupByPropertyId` is `null`, the fallback logic at **lines 492-496** always updates the **status** property:

```typescript
} else if (task && !groupByPropertyId) {
    // Fallback to status update when no groupBy config
    await plugin.updateTaskProperty(task, "status", targetColumnId, {
        silent: false,
    });
    // ...
}
```

This is incorrect because:
- The view **is** grouped (by some property from Bases)
- The code just couldn't determine which property
- Defaulting to status is wrong - it ignores the actual Bases groupBy configuration

## Test File Location

**Test file**: `tests/unit/issues/issue-871-bases-kanban-groupby-drag.test.ts`

**How to run**:
```bash
npm test -- tests/unit/issues/issue-871-bases-kanban-groupby-drag.test.ts
```

The test demonstrates the bug by simulating the drop handler logic with `groupByPropertyId = null`, showing that it incorrectly updates `status` instead of the actual groupBy property.

## Relevant Code Locations

### Primary Bug Location
- **File**: `src/bases/kanban-view.ts:492-496`
  - Fallback logic that incorrectly defaults to updating status property

### Related Code
- **File**: `src/bases/kanban-view.ts:159-205`
  - GroupBy property determination logic (uses caching and inference)
  - Only infers for status and priority, leaves others as null

- **File**: `src/bases/kanban-view.ts:404-507`
  - Drop handler that uses groupByPropertyId to determine which property to update
  - Contains the problematic fallback at lines 492-496

- **File**: `src/bases/group-by.ts:33-125`
  - `getBasesGroupByConfig()` function that attempts to retrieve groupBy config from Bases
  - This is the fallback method used when public API fails

## Proposed Solutions

### Solution 1: Remove the Fallback and Make GroupBy Mandatory
**Approach**: Remove the fallback logic entirely and prevent drag-and-drop when groupByPropertyId cannot be determined.

**Changes**:
```typescript
// In src/bases/kanban-view.ts, lines 492-503
} else if (task && !groupByPropertyId) {
    // No groupBy property determined - disable drag and drop
    console.warn("[TaskNotes][Bases] Cannot update task: groupBy property not determined");
    new Notice("Cannot move task: grouping property not detected");
    // Refresh to revert the optimistic UI update
    setTimeout(() => {
        if (basesViewInstance && typeof basesViewInstance.refresh === "function") {
            basesViewInstance.refresh();
        }
    }, 100);
}
```

**Pros**:
- Simple and safe - won't corrupt data
- Makes the limitation explicit to users
- Encourages fixing the root cause (groupBy detection)

**Cons**:
- Breaks functionality for users when groupBy can't be detected
- Poor user experience (drag-and-drop just doesn't work)
- Doesn't address the root cause

### Solution 2: Improve GroupBy Detection Using Bases Config API
**Approach**: Enhance the groupBy detection logic to better extract the groupBy configuration from Bases, rather than trying to infer it.

**Changes**:
1. Enhance `getBasesGroupByConfig()` in `src/bases/group-by.ts` to try more API methods
2. Use the `viewContext.data.groupedData` structure to extract the groupBy field name from Bases metadata
3. Pass the Bases container context through to the drop handler so it can access `getBasesGroupByConfig()`

**Implementation**:
```typescript
// In src/bases/kanban-view.ts, enhance groupByPropertyId determination (lines 159-205)
if (cachedGroupByPropertyId === undefined) {
    // Try public API first
    if (viewContext.config && typeof viewContext.config.getAsPropertyId === "function") {
        try {
            groupByPropertyId = viewContext.config.getAsPropertyId("groupBy");
        } catch (e) {
            if (typeof viewContext.config.get === "function") {
                groupByPropertyId = viewContext.config.get("groupBy");
            }
        }
    }

    // Try using getBasesGroupByConfig as fallback
    if (!groupByPropertyId) {
        const groupByConfig = getBasesGroupByConfig(basesContainer, pathToProps);
        if (groupByConfig) {
            groupByPropertyId = groupByConfig.normalizedId;
        }
    }

    // If still null, try inference (existing code)
    if (!groupByPropertyId && viewContext.data.groupedData.length > 0) {
        // ... existing inference logic ...
    }

    cachedGroupByPropertyId = groupByPropertyId;
}

// In drop handler, if still null, use getBasesGroupByConfig again
} else if (task && !groupByPropertyId) {
    // Try to get groupBy config one more time
    const groupByConfig = getBasesGroupByConfig(basesContainer, pathToProps);
    if (groupByConfig) {
        // Use the determined groupBy property
        const propertyName = groupByConfig.normalizedId.includes(".")
            ? groupByConfig.normalizedId.split(".").pop() || groupByConfig.normalizedId
            : groupByConfig.normalizedId;

        // Update the appropriate property based on type
        // (reuse the existing property update logic from lines 423-483)
    } else {
        // Still can't determine - show error
        console.warn("[TaskNotes][Bases] Cannot determine groupBy property");
        new Notice("Cannot move task: grouping property not detected");
    }
}
```

**Pros**:
- Addresses the root cause by improving detection
- Maintains drag-and-drop functionality in more cases
- Uses existing utility functions (`getBasesGroupByConfig`)

**Cons**:
- More complex implementation
- May still fail for some edge cases
- Requires understanding Bases API internals

### Solution 3: Use Bases Public API to Get GroupBy Configuration Reliably (Recommended)
**Approach**: According to the code comments, Bases has a public API (v1.10.0+). Ensure we're using the most reliable methods to get the groupBy configuration and handle edge cases properly.

**Changes**:
1. Store both `basesContainer` and `pathToProps` in the drop handler closure
2. When groupByPropertyId is null, attempt to get it using `getBasesGroupByConfig()`
3. If that also fails, disable the drop but provide clear user feedback
4. Add logging to help diagnose why groupByPropertyId is null

**Implementation**:
```typescript
// In src/bases/kanban-view.ts, modify createColumnElement (lines 318-510)
const createColumnElement = (
    columnId: string,
    tasks: TaskInfo[],
    groupByPropertyId: string | null,
    visibleProperties: string[],
    basesViewInstance: any
): HTMLElement => {
    // ... existing code ...

    // Add drop handlers - enhanced for dynamic groupBy
    addColumnDropHandlers(columnEl, async (taskPath: string, targetColumnId: string) => {
        try {
            const task = await plugin.cacheManager.getCachedTaskInfo(taskPath);
            let effectiveGroupByPropertyId = groupByPropertyId;

            // If groupByPropertyId is null, try to determine it now
            if (!effectiveGroupByPropertyId) {
                console.debug("[TaskNotes][Bases] groupByPropertyId is null, attempting to determine from Bases config");
                const groupByConfig = getBasesGroupByConfig(basesContainer, pathToProps);
                if (groupByConfig) {
                    effectiveGroupByPropertyId = groupByConfig.normalizedId;
                    console.debug("[TaskNotes][Bases] Determined groupBy property:", effectiveGroupByPropertyId);
                } else {
                    console.warn("[TaskNotes][Bases] Cannot determine groupBy property from Bases config");
                }
            }

            if (task && effectiveGroupByPropertyId) {
                // ... existing property update logic (lines 408-483) ...
            } else if (task && !effectiveGroupByPropertyId) {
                // Cannot determine groupBy - show error and prevent update
                console.error("[TaskNotes][Bases] Cannot move task: groupBy property could not be determined", {
                    hasConfig: !!viewContext.config,
                    hasGroupedData: !!viewContext.data?.groupedData,
                    groupedDataLength: viewContext.data?.groupedData?.length
                });

                new Notice("Cannot move task: grouping property not detected. Please check your Bases view configuration.");

                // Refresh to revert the UI
                setTimeout(() => {
                    if (basesViewInstance && typeof basesViewInstance.refresh === "function") {
                        basesViewInstance.refresh();
                    }
                }, 100);
            }
        } catch (e) {
            console.error("[TaskNotes][Bases] Move failed:", e);
        }
    });

    return columnEl;
};
```

**Pros**:
- Attempts to fix the issue at drop-time using available config
- Provides clear error messages to users when it can't be fixed
- Includes diagnostic logging to help identify the root cause
- Falls back gracefully without corrupting data
- Relatively simple to implement

**Cons**:
- Still may not work in all cases if Bases config is truly unavailable
- Requires passing additional context to the drop handler

## Recommended Approach

**Solution 3** is recommended because it:

1. **Attempts to fix the issue dynamically**: Tries to determine the groupBy property at drop-time using `getBasesGroupByConfig()`
2. **Prevents data corruption**: Never falls back to updating status when groupBy can't be determined
3. **Provides clear feedback**: Shows specific error messages to users
4. **Aids debugging**: Includes diagnostic logging to understand why groupBy detection fails
5. **Incremental improvement**: Can be enhanced further by improving `getBasesGroupByConfig()` or the public API usage

### Implementation Steps

1. Modify the drop handler to attempt `getBasesGroupByConfig()` when `groupByPropertyId` is null
2. Replace the status fallback (lines 492-496) with error handling
3. Add diagnostic logging to understand groupBy detection failures
4. Test with various Bases groupBy configurations (priority, projects, custom fields)
5. If needed, enhance `getBasesGroupByConfig()` to handle more cases

### Future Enhancements

After implementing Solution 3, consider:

1. **Enhanced Inference**: Expand the inference logic (lines 172-198) to detect more property types by examining group values (e.g., project paths, context format)
2. **Bases API Documentation**: Document which Bases API methods are reliable for getting groupBy config
3. **Cache Invalidation**: Ensure `cachedGroupByPropertyId` is invalidated when the Bases view configuration changes
4. **User Settings**: Add a setting to manually specify the groupBy property mapping for Bases views
