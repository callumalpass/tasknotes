import { ItemView } from 'obsidian';
import { ViewPerformanceService, ViewPerformanceConfig, ViewUpdateHandler } from '../services/ViewPerformanceService';
import { TaskInfo } from '../types';
import TaskNotesPlugin from '../main';

/**
 * Mixin interface for views that want performance optimizations
 */
export interface OptimizedView {
    plugin: TaskNotesPlugin;
    viewPerformanceService?: ViewPerformanceService;
    performanceConfig?: ViewPerformanceConfig;

    // Methods that implementing views should provide
    updateForTask(taskPath: string, operation: 'update' | 'delete' | 'create'): Promise<void>;
    refresh(force?: boolean): Promise<void>;
    shouldRefreshForTask?(originalTask: TaskInfo | undefined, updatedTask: TaskInfo): boolean;
}

/**
 * Initialize performance optimizations for a view
 */
export function initializeViewPerformance(
    view: OptimizedView & ItemView,
    config: Partial<ViewPerformanceConfig>
): void {
    const fullConfig: ViewPerformanceConfig = {
        viewId: view.getViewType(),
        debounceDelay: 100,
        maxBatchSize: 5,
        changeDetectionEnabled: true,
        ...config
    };

    view.performanceConfig = fullConfig;
    view.viewPerformanceService = view.plugin.viewPerformanceService;

    if (view.viewPerformanceService) {
        const handler: ViewUpdateHandler = {
            updateForTask: view.updateForTask.bind(view),
            refresh: view.refresh.bind(view),
            shouldRefreshForTask: view.shouldRefreshForTask?.bind(view)
        };

        view.viewPerformanceService.registerView(fullConfig, handler);
    } else {
        console.warn(`[ViewOptimizations] ViewPerformanceService not available for ${fullConfig.viewId}`);
    }
}

/**
 * Cleanup performance optimizations when view is closed
 */
export function cleanupViewPerformance(view: OptimizedView & ItemView): void {
    if (view.viewPerformanceService && view.performanceConfig) {
        view.viewPerformanceService.unregisterView(view.performanceConfig.viewId);
    }
}

/**
 * Helper for views that want to determine if they should refresh for a task update
 */
export function shouldRefreshForDateBasedView(
    originalTask: TaskInfo | undefined,
    updatedTask: TaskInfo
): boolean {
    if (!originalTask) return true;

    // For date-based views (calendars, agendas), check if date-related fields or visual properties changed
    return originalTask.due !== updatedTask.due ||
           originalTask.scheduled !== updatedTask.scheduled ||
           originalTask.status !== updatedTask.status ||
           originalTask.completedDate !== updatedTask.completedDate ||
           originalTask.recurrence !== updatedTask.recurrence ||
           originalTask.priority !== updatedTask.priority || // Priority affects event visual appearance
           originalTask.title !== updatedTask.title || // Title changes should be reflected
           originalTask.archived !== updatedTask.archived || // Archived tasks should disappear from date-based views
           originalTask.path !== updatedTask.path; // Path changes indicate the file moved and need re-render
}

/**
 * Helper for views that want to determine if they should refresh for task properties
 */
export function shouldRefreshForPropertyBasedView(
    originalTask: TaskInfo | undefined,
    updatedTask: TaskInfo,
    watchedProperties: (keyof TaskInfo)[]
): boolean {
    if (!originalTask) return true;

    // Check if any of the watched properties changed
    return watchedProperties.some(prop => originalTask[prop] !== updatedTask[prop]);
}

/**
 * Generic selective update implementation for list-based views
 * This can be used by TaskListView, KanbanView, etc.
 */
export async function selectiveUpdateForListView(
    view: ItemView & { taskElements?: Map<string, HTMLElement>; plugin: TaskNotesPlugin },
    taskPath: string,
    operation: 'update' | 'delete' | 'create'
): Promise<void> {
    if (!view.taskElements) {
        // Fallback to full refresh if view doesn't have taskElements tracking
        await (view as any).refresh?.();
        return;
    }

    const taskElement = view.taskElements.get(taskPath);

    switch (operation) {
        case 'update':
            if (taskElement) {
                // Task is visible - update it in place
                const updatedTask = await view.plugin.cacheManager.getTaskInfo(taskPath);
                if (updatedTask) {
                    // Get visible properties from the view instead of extracting from DOM
                    const visibleProperties = (view as any).getCurrentVisibleProperties?.() || ['due', 'scheduled', 'projects', 'contexts', 'tags'];
                    await updateTaskElementInPlace(taskElement, updatedTask, view.plugin, visibleProperties);
                } else {
                    // Task was deleted, remove from view
                    taskElement.remove();
                    view.taskElements.delete(taskPath);
                }
            }
            // If task not visible, no action needed
            break;

        case 'delete':
            if (taskElement) {
                taskElement.remove();
                view.taskElements.delete(taskPath);
            }
            break;

        case 'create':
            // For new tasks, we generally need to check if they should be visible
            // This is view-specific, so fallback to refresh for now
            await (view as any).refresh?.();
            break;
    }
}

/**
 * Update a task element in place using TaskCard functionality
 */
async function updateTaskElementInPlace(
    element: HTMLElement,
    taskInfo: TaskInfo,
    plugin: TaskNotesPlugin,
    visibleProperties: string[]
): Promise<void> {
    try {
        // Use the existing updateTaskCard function if available
        const { updateTaskCard } = await import('../ui/TaskCard');

        updateTaskCard(element, taskInfo, plugin, visibleProperties, {
            showDueDate: true,
            showCheckbox: false,
            showArchiveButton: true,
            showTimeTracking: true
        });

        // Add update animation
        element.classList.add('task-card--updated');
        window.setTimeout(() => {
            element.classList.remove('task-card--updated');
        }, 1000);

    } catch (error) {
        console.error('[ViewOptimizations] Error updating task element in place:', error);
        // Could fallback to full refresh here if needed
    }
}

/**
 * Extract visible properties from an existing task element
 * This is a best-effort attempt to determine what properties are currently shown
 */
function extractVisiblePropertiesFromElement(element: HTMLElement): string[] {
    const properties: string[] = ['title']; // Title is always visible

    // Check for various property elements that might be present
    if (element.querySelector('[data-property="due"]')) properties.push('due');
    if (element.querySelector('[data-property="scheduled"]')) properties.push('scheduled');
    if (element.querySelector('[data-property="priority"]')) properties.push('priority');
    if (element.querySelector('[data-property="status"]')) properties.push('status');
    if (element.querySelector('[data-property="contexts"]')) properties.push('contexts');
    if (element.querySelector('[data-property="projects"]')) properties.push('projects');
    if (element.querySelector('[data-property="tags"]')) properties.push('tags');

    return properties;
}

/**
 * Performance monitoring utility for debugging
 */
export class ViewPerformanceMonitor {
    private startTimes = new Map<string, number>();

    startTimer(operation: string): void {
        this.startTimes.set(operation, performance.now());
    }

    endTimer(operation: string, logThreshold = 100): number {
        const startTime = this.startTimes.get(operation);
        if (!startTime) return 0;

        const elapsed = performance.now() - startTime;
        this.startTimes.delete(operation);

        if (elapsed > logThreshold) {
            console.log(`[Performance] ${operation} took ${elapsed.toFixed(2)}ms`);
        }

        return elapsed;
    }

    measureAsync<T>(operation: string, fn: () => Promise<T>): Promise<T> {
        this.startTimer(operation);
        return fn().finally(() => this.endTimer(operation));
    }
}
