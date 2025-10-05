# Issue #826: Task Widget Not Shown on Obsidian Start

## Problem Understanding

### Bug Description
When Obsidian starts with a task note already open:
- The task card widget at the top of the note is **not displayed** initially
- The console shows an error: `Error dispatching task card update: Error: Calls to EditorView.update are not allowed while an update is in progress`
- The subtasks widget (if present) **works correctly** and appears immediately
- **Workarounds**: The widget appears after making changes to the note or closing and reopening it

### Impact
- Poor user experience when starting Obsidian with task notes open
- Inconsistent behavior between task card widget and subtasks widget
- Users must perform extra actions to see the task card widget

## Test File Location

**Test File**: `tests/unit/editor/TaskCardNoteDecorations.test.ts`

**How to Run**:
```bash
npm run test:unit -- TaskCardNoteDecorations
```

The test simulates the EditorView update state during Obsidian startup and verifies that:
1. No `view.dispatch()` calls occur during the initial construction phase
2. The plugin doesn't throw errors when instantiated during an ongoing update
3. Widget rendering is deferred until after the initial update cycle completes

## Relevant Code Locations

### Primary Issue Location

**File**: `src/editor/TaskCardNoteDecorations.ts`

- **Constructor** (lines 110-122): Calls `buildDecorations()` synchronously, then `loadTaskForCurrentFile()` asynchronously
- **loadTaskForCurrentFile()** (lines 203-253): Uses synchronous `getCachedTaskInfoSync()` and calls `dispatchUpdate()` immediately when task changes
- **dispatchUpdate()** (lines 189-201): Calls `view.dispatch()` which throws error if called during an update cycle

### Key Code Paths

1. **TaskCardNoteDecorationsPlugin Constructor** (`src/editor/TaskCardNoteDecorations.ts:110-122`)
   ```typescript
   constructor(view: EditorView, private plugin: TaskNotesPlugin) {
       this.view = view;
       this.decorations = this.buildDecorations(view);  // Sync call
       this.setupEventListeners();
       this.loadTaskForCurrentFile(view);  // Async call, but executes sync code
   }
   ```

2. **loadTaskForCurrentFile** (`src/editor/TaskCardNoteDecorations.ts:203-253`)
   ```typescript
   private loadTaskForCurrentFile(view: EditorView) {
       const newTask = this.plugin.cacheManager.getCachedTaskInfoSync(file.path);  // SYNC
       if (taskChanged) {
           this.cachedTask = newTask;
           this.dispatchUpdate();  // Called during constructor execution!
       }
   }
   ```

3. **dispatchUpdate** (`src/editor/TaskCardNoteDecorations.ts:189-201`)
   ```typescript
   private dispatchUpdate() {
       this.version++;
       try {
           this.view.dispatch({  // ERROR: Called during ongoing update
               effects: [taskCardUpdateEffect.of({ forceUpdate: true })],
           });
       } catch (error) {
           console.error("Error dispatching task card update:", error);  // This is logged
       }
   }
   ```

### Working Comparison: ProjectNoteDecorations

**File**: `src/editor/ProjectNoteDecorations.ts`

- **Constructor** (lines 750-763): Similar structure but uses **async** data loading
- **loadTasksForCurrentFile** (lines 877-932): Uses `await this.projectService.getTasksLinkedToProject(file)` which defers the dispatch call
- This natural deferral prevents the dispatch from happening during the initial update cycle

Key difference at line 882:
```typescript
const newTasks = await this.projectService.getTasksLinkedToProject(file);  // ASYNC
```

## Root Cause Analysis

### The Problem

1. **During Obsidian startup**, when a task note is already open, the `TaskCardNoteDecorationsPlugin` constructor is called **during an active EditorView update cycle**

2. **Synchronous data loading**: The plugin uses `getCachedTaskInfoSync()` which returns data immediately

3. **Immediate dispatch**: When task data is available, `loadTaskForCurrentFile()` calls `dispatchUpdate()` which tries to call `view.dispatch()`

4. **EditorView restriction**: CodeMirror/EditorView doesn't allow `dispatch()` calls while an update is in progress, throwing the error

### Why Subtasks Widget Works

The `ProjectNoteDecorations` (subtasks widget) uses **async** data loading:
- `await this.projectService.getTasksLinkedToProject(file)`
- This pushes the `dispatchUpdate()` call to the next microtask/tick
- By then, the initial EditorView update has completed
- `view.dispatch()` succeeds without error

### Why Workarounds Work

1. **Making changes**: Triggers a new update cycle where dispatch is allowed
2. **Closing and reopening**: Creates a fresh EditorView instance with no ongoing update

## Proposed Solutions

### Solution 1: Defer Dispatch with setTimeout/queueMicrotask (Recommended)

**Approach**: Wrap the `dispatchUpdate()` call in `queueMicrotask()` or `setTimeout()` to defer it until after the current update cycle completes.

**Implementation**:
```typescript
private dispatchUpdate() {
    this.version++;
    if (this.view && typeof this.view.dispatch === "function") {
        // Defer dispatch to avoid calling during active update cycle
        queueMicrotask(() => {
            try {
                this.view.dispatch({
                    effects: [taskCardUpdateEffect.of({ forceUpdate: true })],
                });
            } catch (error) {
                console.error("Error dispatching task card update:", error);
            }
        });
    }
}
```

**Pros**:
- **Minimal code change**: Only affects `dispatchUpdate()` method
- **Simple and reliable**: `queueMicrotask()` ensures execution after current synchronous code
- **Maintains synchronous data loading**: No need to refactor cache system
- **Matches async behavior**: Achieves same deferral as ProjectNoteDecorations

**Cons**:
- Slight delay before widget appears (negligible, 1 microtask)
- Adds async behavior to sync code path

**Files to modify**:
- `src/editor/TaskCardNoteDecorations.ts:189-201` (dispatchUpdate method)

---

### Solution 2: Make loadTaskForCurrentFile Async

**Approach**: Convert `loadTaskForCurrentFile()` to async and use `await` with a promise-wrapped version of `getCachedTaskInfoSync()`.

**Implementation**:
```typescript
private async loadTaskForCurrentFile(view: EditorView) {
    const file = this.getFileFromView(view);

    if (file instanceof TFile) {
        try {
            // Wrap sync call in promise to defer execution
            const newTask = await Promise.resolve(
                this.plugin.cacheManager.getCachedTaskInfoSync(file.path)
            );

            // ... rest of the method unchanged
            if (taskChanged) {
                this.cachedTask = newTask;
                this.dispatchUpdate();
            }
        } catch (error) {
            console.error("Error loading task for task note:", error);
        }
    } else {
        if (this.cachedTask !== null) {
            this.cachedTask = null;
            this.dispatchUpdate();
        }
    }
}
```

**Pros**:
- More explicit about async nature
- Follows the pattern used in ProjectNoteDecorations
- Could facilitate future async cache operations

**Cons**:
- **Larger change**: Function signature changes from sync to async
- May require updating callers (constructor already doesn't await it)
- Adds promise overhead for sync operation
- Less semantically accurate (wrapping sync in async)

**Files to modify**:
- `src/editor/TaskCardNoteDecorations.ts:203-253` (loadTaskForCurrentFile method)

---

### Solution 3: Check EditorView State Before Dispatch

**Approach**: Add a flag to track if we're in the initial construction phase and skip dispatch during that time.

**Implementation**:
```typescript
class TaskCardNoteDecorationsPlugin implements PluginValue {
    decorations: DecorationSet;
    private cachedTask: TaskInfo | null = null;
    private currentFile: TFile | null = null;
    private eventListeners: EventRef[] = [];
    private view: EditorView;
    private version = 0;
    private isInitializing = true;  // NEW FLAG

    constructor(view: EditorView, private plugin: TaskNotesPlugin) {
        this.view = view;
        this.decorations = this.buildDecorations(view);
        this.setupEventListeners();
        this.loadTaskForCurrentFile(view);

        // Mark initialization complete after current update cycle
        queueMicrotask(() => {
            this.isInitializing = false;
            // Trigger deferred update if needed
            if (this.cachedTask) {
                this.dispatchUpdate();
            }
        });
    }

    private dispatchUpdate() {
        // Skip dispatch during initialization
        if (this.isInitializing) {
            return;
        }

        this.version++;
        if (this.view && typeof this.view.dispatch === "function") {
            try {
                this.view.dispatch({
                    effects: [taskCardUpdateEffect.of({ forceUpdate: true })],
                });
            } catch (error) {
                console.error("Error dispatching task card update:", error);
            }
        }
    }
}
```

**Pros**:
- Explicit control over when dispatch is allowed
- Clear initialization phase management
- Guarantees no dispatch during construction

**Cons**:
- **More complex**: Adds state management and deferred update logic
- **More code changes**: Constructor and dispatchUpdate both modified
- Requires careful handling of deferred updates
- Adds initialization flag that must be maintained

**Files to modify**:
- `src/editor/TaskCardNoteDecorations.ts:102-122` (add flag, modify constructor)
- `src/editor/TaskCardNoteDecorations.ts:189-201` (modify dispatchUpdate)

---

## Recommended Approach

**Solution 1: Defer Dispatch with queueMicrotask** is the recommended approach because:

1. **Minimal change**: Single method modification, low risk
2. **Clean solution**: Directly addresses the timing issue without complexity
3. **Proven pattern**: Similar to how async operations naturally defer execution
4. **Maintains existing architecture**: No need to refactor data loading or add state management
5. **Fast to implement and test**: Simple change with clear behavior

### Implementation Plan

1. Modify `src/editor/TaskCardNoteDecorations.ts:189-201`
2. Wrap `view.dispatch()` call in `queueMicrotask()`
3. Add test to verify no errors during initialization
4. Test in Obsidian with task note open at startup
5. Verify widget appears correctly after deferral

### Alternative if Solution 1 Fails

If `queueMicrotask()` proves insufficient (unlikely), Solution 3 provides the most robust guarantee by explicitly managing the initialization state, though at the cost of additional complexity.

Solution 2 is not recommended as it adds unnecessary async overhead and doesn't provide clear benefits over Solution 1.
