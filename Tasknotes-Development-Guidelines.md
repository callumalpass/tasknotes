# TaskNotes Plugin: Architecture & Developer's Guide

## 1. Introduction & Guiding Principles

This guide is designed to help you understand the architecture of the TaskNotes plugin, ensuring that new features and updates are implemented in a way that is consistent, maintainable, and performant.

The architecture of this plugin is built on several key principles:

*   **Separation of Concerns:** Logic is separated into distinct layers: UI (Views & Components), Business Logic (Services), and Data (Minimal Cache & Obsidian Native Cache). This makes the codebase easier to reason about and test.
*   **Native-First Data Access:** Obsidian's `metadataCache` is the primary source of truth for all task and note data. The minimal cache layer exists primarily to coordinate event signals and maintain only performance-critical indexes.
*   **Unidirectional Data Flow:** Changes flow in one direction: User Action -> Service -> File System -> Native Cache -> Event Coordination -> UI Update. This predictable pattern prevents complex state management issues and race conditions.
*   **Event-Driven Communication:** Components are decoupled through centralized event coordination. The minimal cache coordinates view updates efficiently, preventing multiple views from redundantly scanning files.
*   **Performance Through Coordination:** Rather than complex indexing, performance is achieved through intelligent event coordination, lazy computation, and leveraging Obsidian's optimized native cache.
*   **Configuration-Driven:** Core functionalities like statuses, priorities, and field names are not hard-coded. They are managed by dedicated services (`StatusManager`, `PriorityManager`, `FieldMapper`) that interpret user settings, making the plugin highly customizable.
*   **Obsidian Optimization Compliance:** The plugin follows Obsidian's best practices for load time optimization and deferred view compatibility, ensuring fast startup and smooth integration with the latest Obsidian versions.

## 2. High-Level Architecture Diagram

This diagram illustrates the flow of data and events within the plugin, emphasizing the native-first approach:

```
+----------------+       +------------------+       +------------------+
|   User Input   |------>|   UI / Views     |------>|   Services       |
| (Click, Drag)  |       | (Agenda, Kanban) |       | (TaskService, etc) |
+----------------+       +------------------+       +------------------+
      ^                                                     |
      |                                                     | (1. Write to file)
      |                                                     v
      |                                               +------------+
      | (5. UI Update via                               | File System|
      |     DOMReconciler)                              |  (.md)     |
      |                                               +------------+
      |                                                     |
      |                                                     | (2. Native metadata update)
      +---------------------+                               v
+---------------------+     |                         +------------------+
|    DOMReconciler    |     | (4. Coordinated view    | Obsidian Native  | (Primary Source
| (Efficient Updates) |<----+     updates)            | MetadataCache    |  of Truth)
+---------------------+     |                         +------------------+
                            |                               |
                            |                               | (3. Event coordination)
                            |                               v
                          +-----------------------------------+
                          |   MinimalCache (Event Coordinator)|
                          |   - Essential indexes only        |
                          |   - Coordinates view refreshes    |
                          +-----------------------------------+
```

## 3. Directory Structure

The project is organized to reflect the architectural layers:

*   `/src/`
    *   `main.ts`: The plugin's entry point. It initializes all services, views, and commands.
    *   `types.ts`: **Crucial.** Contains all shared type definitions. All new types should be added here.
    *   `/views/`: Contains the primary UI views (`TaskListView`, `AgendaView`, `KanbanView`, etc.), which are `ItemView` implementations registered with Obsidian.
    *   `/ui/`: Contains reusable, "dumb" UI components like `TaskCard`, `NoteCard`, and `FilterBar`. These components are responsible for rendering data, not fetching it.
    *   `/modals/`: Contains all modals for user interaction (`TaskCreationModal`, `TaskEditModal`, etc.).
    *   `/services/`: The core business logic of the plugin resides here. Each service has a specific responsibility (e.g., `TaskService` for CRUD, `FilterService` for querying, `PomodoroService` for timers).
    *   `/editor/`: Contains CodeMirror extensions that enhance the Obsidian editor, like `TaskLinkWidget` and `InstantConvertButtons`.
    *   `/utils/`: Contains helper classes and functions that support the entire plugin, such as `MinimalNativeCache`, `dateUtils`, and `DOMReconciler`.
    *   `/settings/`: Contains the settings tab UI and default settings configuration.
*   `/styles/`: Contains all CSS files, which are compiled into a single `styles.css`.

## 4. Key Architectural Concepts

### 4.1. The Data Flow: A Step-by-Step Guide

Understanding this native-first flow is the most important part of contributing to the plugin.

1.  **User Action**: A user interacts with the UI (e.g., clicks "Archive" on a `TaskCard`).
2.  **Service Call**: The UI component's event handler calls the relevant method in a service (e.g., `plugin.taskService.toggleArchive(task)`). **UI components should never modify data directly.**
3.  **File System Write**: The service performs the necessary changes on the Markdown file's frontmatter.
4.  **Native Cache Update**: Obsidian's native metadata cache automatically updates with the new file content.
5.  **Minimal Cache Coordination**: The minimal cache detects the native change and updates only essential indexes, then coordinates view refresh events.
6.  **Event Emission**: The minimal cache emits coordinated events (e.g., `EVENT_TASK_UPDATED`) to prevent redundant view updates.
7.  **Coordinated View Refresh**: Views receive coordinated events and refresh efficiently, fetching fresh data directly from the native metadata cache.
8.  **DOM Reconciliation**: Views use the `DOMReconciler` to efficiently update only the parts of the UI that have changed.

### 4.2. The Minimal Cache - Event Coordinator & Performance Guardian

The `MinimalNativeCache` serves as an intelligent coordinator rather than a data warehouse. Its primary purpose is **view performance coordination**, not data storage.

*   **Core Philosophy**: Leverage Obsidian's native metadata cache maximally while coordinating view updates efficiently.

*   **What it Does**:
    *   **Event Coordination**: Prevents multiple views from simultaneously scanning files by coordinating refresh signals
    *   **Essential Indexing**: Maintains only 3 performance-critical indexes: `tasksByDate`, `tasksByStatus`, `overdueTasks`
    *   **Native Integration**: Listens to Obsidian's native metadata events and translates them to coordinated view updates
    *   **Lazy Computation**: Computes tags, contexts, and priorities on-demand rather than pre-indexing

*   **What it Doesn't Do**:
    *   **Data Storage**: Task data comes directly from `app.metadataCache.getFileCache()`
    *   **Complex Indexing**: No redundant data structures duplicating native cache
    *   **Note Management**: Notes handled by Obsidian's daily notes interface

*   **The 3 Essential Indexes Explained**:
    ```typescript
    // Only these are indexed for performance:
    tasksByDate: Map<string, Set<string>>    // Calendar view optimization
    tasksByStatus: Map<string, Set<string>>  // FilterService optimization  
    overdueTasks: Set<string>                // Overdue query optimization
    
    // Everything else computed on-demand:
    getAllTags() -> scans native cache when called
    getAllPriorities() -> scans native cache when called
    getTasksByPriority() -> filters all tasks when called
    ```

*   **Performance Benefits of Coordination**:
    ```typescript
    // Without coordination: Multiple views scan independently
    CalendarView -> scans 1000 files for date tasks
    AgendaView   -> scans 1000 files for date tasks  
    KanbanView   -> scans 1000 files for status tasks
    // Result: 3000 file scans on data change
    
    // With coordination: Single coordinated update
    MinimalCache -> coordinates single refresh signal
    All views    -> refresh once with targeted data
    // Result: 1 coordinated update cycle
    ```

*   **Developer Best Practices**:
    *   **Read from native cache**: Use `app.metadataCache.getFileCache(file)` for direct data access
    *   **Coordinate through minimal cache**: Use cache for event coordination and essential indexes only
    *   **Never duplicate data**: Don't store data that's already in the native cache
    *   **Leverage lazy computation**: Compute infrequently-accessed data on-demand
    *   **Update essential indexes**: When adding date/status-related features, consider index impact

### 4.3. The Event System - Coordinated Communication

The event system now focuses on **coordination efficiency** rather than complex pub/sub patterns.

*   **Purpose**: Coordinate view updates efficiently while preventing redundant operations. The minimal cache serves as an intelligent event dispatcher.

*   **Coordination Patterns**:
    ```typescript
    // Efficient: Coordinated update
    minimalCache.on('file-updated', (data) => {
        // All views receive coordinated signal
        // Each view refreshes with fresh native cache data
    });
    
    // Inefficient: Direct native listening (avoided)
    app.metadataCache.on('changed', (file) => {
        // Each view independently processes the same change
        // Results in redundant scanning and processing
    });
    ```

*   **Event Coordination Benefits**:
    *   **Prevents Duplicate Work**: Single file change doesn't trigger multiple view scans
    *   **Batched Updates**: Multiple rapid changes can be batched into single refresh
    *   **Performance Isolation**: Slow views don't impact fast views through coordination

*   **Developer Best Practices**:
    *   **Use coordinated events**: Listen to minimal cache events, not native cache directly
    *   **Fetch fresh data**: On event receipt, fetch fresh data from native cache
    *   **Avoid event proliferation**: Don't create multiple event types for the same data change

### 4.4. Date and Time Management (`dateUtils.ts`)

Handling dates and times is notoriously difficult due to timezones and different formats. This plugin standardizes date/time handling through `dateUtils.ts`.

*   **The Problem**: JavaScript's `new Date()` is inconsistent. `new Date('2023-10-27')` creates a UTC date, while `new Date('2023-10-27T10:00:00')` creates a local timezone date. This leads to "off-by-one-day" errors.
*   **The Solution**: A set of centralized utility functions in `dateUtils.ts` that handle these nuances.
*   **Developer Best Practices**:
    *   **Never use `new Date(dateString)` directly.** Always use `parseDate(dateString)` from `dateUtils.ts`. It intelligently handles both date-only and full ISO timestamp strings.
    *   For comparisons, use the provided safe functions: `isSameDateSafe`, `isBeforeDateSafe`, `isOverdueTimeAware`. These functions correctly normalize dates before comparing.
    *   When creating a new timestamp for `dateCreated` or `dateModified`, always use `getCurrentTimestamp()`. This generates a consistent, timezone-aware ISO string.
    *   When you only need the date part (e.g., `YYYY-MM-DD`), use `getDatePart(dateString)`.
    *   Use `hasTimeComponent(dateString)` to determine if a date string includes time information, and branch your logic accordingly.

### 4.5. The UI Layer (Views and Components)

*   **Views (`/views/`)**: These are the main panels of the plugin (e.g., `AgendaView`). They are stateful and responsible for fetching data (via direct native cache access or `FilterService`), managing user interactions, and orchestrating the rendering of their content. They should contain the `FilterBar` and the main content display.

*   **Native-First Data Access**:
    ```typescript
    // Views now access data directly from native cache
    async refreshTasks(): Promise<void> {
        // Get task paths from minimal cache (indexed)
        const taskPaths = this.plugin.cacheManager.getTasksForDate(dateStr);
        
        // Get fresh task data from native cache
        const tasks = await Promise.all(
            taskPaths.map(path => {
                const file = this.app.vault.getAbstractFileByPath(path);
                const metadata = this.app.metadataCache.getFileCache(file);
                return this.extractTaskInfo(path, metadata.frontmatter);
            })
        );
        
        this.renderTasks(tasks);
    }
    ```

*   **Reusable Components (`/ui/`)**: These are "dumb" components like `TaskCard` and `NoteCard`.
    *   They receive data as props (`createTaskCard(task, plugin, options)`).
    *   They are responsible only for rendering that data into HTML.
    *   They should not contain business logic. Any user interaction (like a button click) should call a method on the `plugin` or a `service` passed in as a prop.

*   **DOMReconciler**: To ensure high performance, views do not re-render their entire HTML on every data change. Instead, they use `plugin.domReconciler.updateList()`. This utility efficiently diffs the new data against the existing DOM, only adding, removing, or updating the elements that have changed.

### 4.6. The Field Mapper (`FieldMapper.ts`) - The Data Translator

This is a critical architectural component that enables user customization.

*   **Purpose**: The `FieldMapper` is a "translator" service. Its primary purpose is to decouple the plugin's internal `TaskInfo` property names (e.g., `scheduled`, `timeEstimate`) from the user-configurable property names in the YAML frontmatter of their task files. This allows users to name their properties whatever they like (e.g., `schedule_on`, `estimate_minutes`) without breaking the plugin.

*   **How it Works**: It provides a two-way mapping.
    *   **Reading (File -> `TaskInfo`)**: When processing native metadata cache data, the frontmatter is passed to `fieldMapper.mapFromFrontmatter(frontmatter)`. The service uses the mapping in `settings.fieldMapping` to create a standardized `TaskInfo` object. For example, if the user setting is `{ due: "deadline" }`, the mapper will take `frontmatter.deadline` and put its value into the `taskInfo.due` field.
    *   **Writing (`TaskInfo` -> File)**: When `TaskService` saves a task, it passes the internal `TaskInfo` object to `fieldMapper.mapToFrontmatter(taskInfo)`. This creates a frontmatter object ready for serialization. For example, `taskInfo.due` will be written as `deadline: ...` in the YAML.

*   **Developer Best Practices**:
    *   **Central Point of Interaction**: Any service that directly reads or writes task frontmatter (`MinimalNativeCache`, `TaskService`) **must** use the `FieldMapper`.
    *   **Stable Internal API**: Within the plugin's TypeScript code (views, components, other services), you should **always** interact with the standardized `TaskInfo` properties (`task.due`, `task.priority`, etc.). The `FieldMapper` is the boundary layer that handles the translation to/from the user's world.
    *   **Avoid Hard-coding**: **Never** write code that directly accesses a frontmatter property like `frontmatter.due`. Always use the mapper to get the user-configured field name first.
    *   **Extensibility**: When adding a new persistent property to tasks, you must add it to the `FieldMapping` type in `types.ts`, the `DEFAULT_FIELD_MAPPING` in `settings.ts`, and the mapping logic in `FieldMapper.ts`.

## 5. Developer's Guide: How to Implement Common Changes

### 5.1. Adding a New Property to Tasks

Let's say you want to add a `complexity: 'simple' | 'medium' | 'hard'` property to tasks.

1.  **Update `types.ts`**: Add `complexity?: string;` to the `TaskInfo` interface.
2.  **Update `settings.ts`**:
    *   Add `complexity: string;` to the `FieldMapping` interface in `DEFAULT_FIELD_MAPPING`.
    *   Add a new setting in the `TaskNotesSettingTab` to allow users to configure the property name.
3.  **Update `FieldMapper.ts`**: Add logic to `mapFromFrontmatter` and `mapToFrontmatter` to handle the new `complexity` field.
4.  **Update `TaskService.ts`**:
    *   In `createTask`, handle the new property, possibly applying a default value.
    *   In `updateTask`, ensure the new property can be updated.
5.  **Update `BaseTaskModal.ts`**: Add a dropdown or input field to `TaskCreationModal` and `TaskEditModal` to allow users to set the complexity.
6.  **Update `TaskCard.ts`**: In `createTaskCard` and `updateTaskCard`, add logic to display the new complexity information (e.g., an icon or text in the metadata line).
7.  **Update `FilterService.ts` (Optional)**: If you want to filter by complexity frequently:
    *   Consider whether an index is needed (probably not - compute on-demand)
    *   Add logic to `FilterService.matchesQuery` to filter by complexity.
    *   Add a complexity filter control to `FilterBar.ts`.

**Note**: With the minimal cache approach, most new properties should be computed on-demand rather than indexed. Only add indexes for frequently-accessed, performance-critical queries.

### 5.2. Walkthrough: Modifying a Task Property (Native-First Approach)

Let's trace the flow of changing a task's priority from a `TaskCard`.

1.  **UI (`TaskCard.ts`)**: The user right-clicks the card and selects a new priority from the context menu.
2.  **Event Handler**: The `onClick` handler for the menu item calls `plugin.updateTaskProperty(task, 'priority', newPriorityValue)`.
3.  **Main Plugin (`main.ts`)**: The `updateTaskProperty` method is a convenience wrapper that calls `this.taskService.updateProperty(...)`.
4.  **Service (`TaskService.ts`)**: The `updateProperty` method is executed.
    a. It finds the `TFile` for the task.
    b. It uses `app.fileManager.processFrontMatter()` to open the file and update the YAML. It uses the `fieldMapper` to get the correct property name (e.g., it might write `prio: high` instead of `priority: high` if the user configured it that way). It also updates the `dateModified` property.
    c. **Native cache automatically updates** when the file is saved.
    d. The minimal cache detects the native change and **coordinates view updates**.
5.  **Event Coordination**:
    *   **`MinimalNativeCache`**: Detects the native metadata change, updates essential indexes (if priority indexing was needed), and emits coordinated `EVENT_TASK_UPDATED`.
    *   **Views receive coordinated signal**: All views get a single, coordinated update event rather than multiple native events.
6.  **View Updates**:
    *   **`TaskListView.ts`**: The view's listener for `EVENT_TASK_UPDATED` fires. It fetches fresh task data from native cache and uses `updateTaskCard(element, updatedTask, ...)` to efficiently re-render just that one card.
    *   **`AgendaView.ts`**: Its listener fires. Since a priority change might affect sorting, it triggers a `refresh()`, fetching fresh data directly from native cache and using the `DOMReconciler` to update the view.
    *   **Editor (`TaskLinkOverlay.ts`)**: The global listener in `main.ts` dispatches a `taskUpdateEffect` to all open editors. The `TaskLinkField` sees this effect and redraws any `TaskLinkWidget`s for the affected task path with fresh native cache data.

This entire flow happens almost instantaneously, with minimal cache coordination ensuring efficient updates while native cache provides always-fresh data.

### 5.3. When to Add an Index vs Compute On-Demand

**Add to Essential Indexes When**:
- The query is performance-critical (sub-100ms response needed)
- It's accessed very frequently (multiple times per second)
- The computation would involve scanning many files
- Examples: `tasksByDate` (calendar navigation), `tasksByStatus` (kanban boards)

**Compute On-Demand When**:
- The query is infrequent or user-initiated
- The dataset is small (< 1000 items)
- The computation is lightweight
- Examples: `getAllTags()`, `getTasksByPriority()`, `getAllContexts()`

**Decision Framework**:
```typescript
// Performance test: Is this query slow?
console.time('query');
const result = computeOnDemand();
console.timeEnd('query');
// If > 10ms and frequent -> consider indexing
// If < 10ms or infrequent -> keep on-demand
```

## 6. Performance Optimization & Obsidian Best Practices

### 6.1. Plugin Load Time Optimization

Following Obsidian's performance guidelines is crucial for user experience. The plugin implements several key optimizations:

**Load Time Pattern:**
```typescript
async onload() {
    // Essential initialization only
    await this.loadSettings();
    this.initializeLightweightServices();
    
    // Register view types and commands
    this.registerViews();
    this.addCommands();
    
    // Defer expensive operations
    this.app.workspace.onLayoutReady(() => {
        this.initializeAfterLayoutReady();
    });
}

private async initializeAfterLayoutReady() {
    // Minimal cache initialization (lightweight)
    this.cacheManager.initialize();
    
    // Heavy service initialization
    await this.pomodoroService.initialize();
    
    // Editor services with async imports
    const { TaskLinkDetectionService } = await import('./services/TaskLinkDetectionService');
}
```

**Developer Best Practices:**
*   **Keep `onload()` lightweight**: Only include essential setup (settings, service constructors, view registration)
*   **Defer expensive operations**: Move heavy service initialization to `onLayoutReady`
*   **Use lazy index building**: Let minimal cache build essential indexes only when first accessed
*   **Use async imports**: Load large services dynamically to reduce initial bundle size
*   **Avoid vault events in constructors**: Register file watchers after layout is ready

### 6.2. Native Cache Integration Performance

The plugin maximizes Obsidian's native metadata cache performance:

**Efficient Native Access Pattern:**
```typescript
// Efficient: Direct native cache access
getTaskInfo(path: string): TaskInfo | null {
    const file = this.app.vault.getAbstractFileByPath(path);
    const metadata = this.app.metadataCache.getFileCache(file); // Already cached!
    return this.extractTaskInfo(path, metadata.frontmatter);
}

// Efficient: Batch native operations
getAllTasksOfStatus(status: string): TaskInfo[] {
    // Use essential index for paths
    const taskPaths = this.minimalCache.getTaskPathsByStatus(status);
    
    // Batch native cache access
    return taskPaths.map(path => this.getTaskInfo(path)).filter(Boolean);
}
```

**Performance Guidelines:**
*   **Trust native cache speed**: `getFileCache()` is already optimized by Obsidian
*   **Use essential indexes for filtering**: Date and status indexes prevent full scans
*   **Batch operations**: Process multiple files in single operations
*   **Avoid redundant scanning**: Let minimal cache coordinate view updates

### 6.3. Memory Efficiency Through Minimal Indexing

**Memory Optimization Strategy:**
```typescript
// Minimal cache memory footprint
class MinimalNativeCache {
    // Only 3 essential indexes (~70% reduction from previous approach)
    private tasksByDate: Map<string, Set<string>> = new Map();
    private tasksByStatus: Map<string, Set<string>> = new Map(); 
    private overdueTasks: Set<string> = new Set();
    
    // No redundant data storage - everything comes from native cache
    getTaskInfo(path) {
        return this.extractFromNativeCache(path); // Always fresh
    }
}
```

**Memory Benefits:**
*   **No duplicate data**: Task info comes directly from native cache
*   **Minimal index storage**: Only path strings in essential indexes
*   **Lazy computation**: Tags, contexts, priorities computed when needed
*   **Automatic cleanup**: Native cache handles file lifecycle

### 6.4. Deferred View Compatibility

The plugin is compatible with Obsidian v1.7.2+ deferred views:

**View Implementation Pattern:**
```typescript
export class MyView extends ItemView {
    constructor(leaf: WorkspaceLeaf, plugin: TaskNotesPlugin) {
        super(leaf);
        this.plugin = plugin;
        // Lightweight constructor only
    }
    
    async onOpen() {
        // Wait for plugin readiness
        await this.plugin.onReady();
        
        // Initialize view with native cache access
        this.initializeView();
    }
    
    private async refreshData() {
        // Direct native cache access for fresh data
        const taskPaths = this.plugin.cacheManager.getTasksForDate(this.selectedDate);
        const tasks = await Promise.all(
            taskPaths.map(path => {
                const file = this.app.vault.getAbstractFileByPath(path);
                const metadata = this.app.metadataCache.getFileCache(file);
                return this.extractTaskInfo(path, metadata.frontmatter);
            })
        );
        this.renderTasks(tasks);
    }
}
```

## 7. External Data Integration

### 7.1. ICS Calendar Integration Architecture

The plugin supports both remote ICS subscriptions and local ICS files through a unified service architecture:

**Service Structure:**
```typescript
interface ICSSubscription {
    id: string;
    name: string;
    type: 'remote' | 'local';
    url?: string;      // For remote subscriptions
    filePath?: string; // For local files
    color: string;
    enabled: boolean;
    refreshInterval: number;
}
```

**Implementation Pattern:**
```typescript
async fetchSubscription(id: string): Promise<void> {
    const subscription = this.getSubscription(id);
    
    let icsData: string;
    if (subscription.type === 'remote') {
        icsData = await this.fetchRemoteICS(subscription.url);
    } else {
        icsData = await this.readLocalICS(subscription.filePath);
    }
    
    const events = this.parseICS(icsData);
    this.updateCache(id, events);
}
```

### 7.2. File Watching for Local Resources

Local ICS files are automatically monitored for changes:

**File Watcher Pattern:**
```typescript
private startFileWatcher(subscription: ICSSubscription): void {
    const modifyRef = this.plugin.app.vault.on('modify', (file) => {
        if (file.path === subscription.filePath) {
            // Debounce changes
            setTimeout(() => this.refreshSubscription(subscription.id), 1000);
        }
    });
    
    // Store cleanup function
    this.fileWatchers.set(subscription.id, () => {
        this.plugin.app.vault.offref(modifyRef);
    });
}
```

**Developer Best Practices:**
*   **Debounce file changes**: Prevent excessive refreshes on rapid file modifications
*   **Store cleanup references**: Always provide proper cleanup in `destroy()` methods
*   **Handle file deletion**: Gracefully handle cases where watched files are removed
*   **Unified interface**: Keep local and remote data sources compatible through consistent interfaces

## 8. Error Handling & Data Validation

### 8.1. Date/Time Error Prevention

The plugin implements robust date parsing to handle various formats:

**Safe Date Parsing Pattern:**
```typescript
// Always use dateUtils for parsing
import { parseDate, validateDateInput } from '../utils/dateUtils';

// Good
try {
    const date = parseDate(dateString);
    // Process date
} catch (error) {
    // Handle invalid date
}

// Bad - Direct Date constructor
const date = new Date(dateString); // May create unexpected results
```

**Supported Date Formats:**
*   ISO datetime: `2025-02-23T20:28:49`
*   Space-separated: `2025-02-23 20:28:49`
*   Date-only: `2025-02-23`
*   ISO week: `2025-W02`

### 8.2. Type Safety & Validation

**Interface Extension Pattern:**
```typescript
// When adding new optional properties
interface TaskInfo {
    // ... existing properties
    newProperty?: string; // Always optional for backward compatibility
}

// Provide defaults in service layer
const taskWithDefaults = {
    ...existingTask,
    newProperty: existingTask.newProperty || defaultValue
};
```

**Developer Best Practices:**
*   **Make new properties optional**: Ensures backward compatibility
*   **Validate external data**: Always validate data from external sources
*   **Provide meaningful errors**: Help users understand what went wrong
*   **Graceful degradation**: Continue functioning when optional features fail

## 9. Testing & Quality Assurance

### 9.1. Manual Testing Checklist

When implementing new features, test these scenarios:

**Plugin Load Testing:**
*   [ ] Clean Obsidian startup (no existing plugin data)
*   [ ] Startup with existing plugin data
*   [ ] Startup with large vaults (1000+ files)
*   [ ] Hot reload during development

**View Testing:**
*   [ ] View opens correctly when deferred
*   [ ] View responds to coordinated data changes
*   [ ] View handles no data gracefully
*   [ ] View cleanup on close

**Cache Coordination Testing:**
*   [ ] Multiple views update efficiently on file changes
*   [ ] Essential indexes remain consistent
*   [ ] Native cache integration works correctly
*   [ ] Memory usage remains minimal

### 9.2. Performance Testing

**Load Time Metrics:**
*   Plugin should add <50ms to Obsidian startup (improved with minimal cache)
*   Views should render within 200ms of opening
*   File operations should not block UI

**Memory Usage:**
*   Monitor minimal cache index sizes
*   Ensure proper cleanup of event listeners
*   Verify no memory leaks in long-running sessions
*   Check that native cache integration doesn't duplicate data

**Coordination Efficiency:**
*   Single file change should trigger one coordinated update cycle
*   Multiple rapid changes should be batched efficiently
*   View updates should not redundantly scan files

This streamlined architecture ensures the plugin remains performant, maintainable, and maximally leverages Obsidian's native capabilities while providing intelligent coordination for optimal view performance.