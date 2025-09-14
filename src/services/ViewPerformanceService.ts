import { EventRef } from 'obsidian';
import TaskNotesPlugin from '../main';
import { TaskInfo, EVENT_TASK_UPDATED } from '../types';

export interface ViewPerformanceConfig {
    viewId: string;
    debounceDelay?: number;
    maxBatchSize?: number;
    changeDetectionEnabled?: boolean;
}

export interface ViewUpdateHandler {
    updateForTask: (taskPath: string, operation: 'update' | 'delete' | 'create') => Promise<void>;
    refresh: (force?: boolean) => Promise<void>;
    shouldRefreshForTask?: (originalTask: TaskInfo | undefined, updatedTask: TaskInfo) => boolean;
}

/**
 * Centralized performance service for all TaskNotes views
 * Provides change detection, debouncing, batching, and memory management
 */
export class ViewPerformanceService {
    private plugin: TaskNotesPlugin;

    // Global task version cache shared across all views
    private globalTaskVersionCache = new Map<string, string>();
    private lastGlobalRefreshTime = 0;
    private globalTaskCount = 0;

    // View-specific state
    private viewHandlers = new Map<string, ViewUpdateHandler>();
    private viewDebounceTimers = new Map<string, number>();
    private viewPendingUpdates = new Map<string, Set<string>>();
    private viewConfigs = new Map<string, ViewPerformanceConfig>();

    // Event coordination
    private updateInProgress = new Set<string>();
    private eventListener: EventRef | null = null;

    constructor(plugin: TaskNotesPlugin) {
        this.plugin = plugin;
        this.setupGlobalEventListener();
    }

    /**
     * Register a view with the performance service
     */
    registerView(config: ViewPerformanceConfig, handler: ViewUpdateHandler): void {
        this.viewConfigs.set(config.viewId, {
            debounceDelay: 100,
            maxBatchSize: 5,
            changeDetectionEnabled: true,
            ...config
        });
        this.viewHandlers.set(config.viewId, handler);
        this.viewPendingUpdates.set(config.viewId, new Set());

        console.log(`[ViewPerformanceService] Registered view: ${config.viewId}`);
    }

    /**
     * Unregister a view from the performance service
     */
    unregisterView(viewId: string): void {
        // Clean up debounce timer
        const timer = this.viewDebounceTimers.get(viewId);
        if (timer) {
            clearTimeout(timer);
            this.viewDebounceTimers.delete(viewId);
        }

        // Clean up state
        this.viewConfigs.delete(viewId);
        this.viewHandlers.delete(viewId);
        this.viewPendingUpdates.delete(viewId);
        this.updateInProgress.delete(viewId);

        console.log(`[ViewPerformanceService] Unregistered view: ${viewId}`);
    }

    /**
     * Setup global event listener for task updates
     */
    private setupGlobalEventListener(): void {
        this.eventListener = this.plugin.emitter.on(EVENT_TASK_UPDATED, async (eventData: any) => {
            const updatedTask = eventData?.task || eventData?.taskInfo;
            const originalTask = eventData?.originalTask;

            if (!updatedTask || !updatedTask.path) {
                console.log('[ViewPerformanceService] Invalid task update event, triggering full refresh for all views');
                await this.triggerFullRefreshForAllViews();
                return;
            }

            // Check global change detection
            if (!this.hasTaskChanged(updatedTask)) {
                console.log(`[ViewPerformanceService] Skipping update for ${updatedTask.path} - no changes detected`);
                return;
            }

            // Route update to all registered views
            await this.handleTaskUpdateForAllViews(updatedTask, originalTask);
        });
    }

    /**
     * Handle task update for all registered views
     */
    private async handleTaskUpdateForAllViews(updatedTask: TaskInfo, originalTask?: TaskInfo): Promise<void> {
        const updatePromises: Promise<void>[] = [];

        for (const [viewId, handler] of this.viewHandlers) {
            // Check if this view should handle the update
            if (handler.shouldRefreshForTask && !handler.shouldRefreshForTask(originalTask, updatedTask)) {
                console.log(`[ViewPerformanceService] Skipping update for ${viewId} - not relevant`);
                continue;
            }

            updatePromises.push(this.scheduleViewUpdate(viewId, updatedTask.path));
        }

        await Promise.all(updatePromises);

        // Periodic cleanup
        if (Math.random() < 0.1) {
            await this.cleanupTaskVersionCache();
        }
    }

    /**
     * Schedule a debounced update for a specific view
     */
    private async scheduleViewUpdate(viewId: string, taskPath: string): Promise<void> {
        const config = this.viewConfigs.get(viewId);
        if (!config) return;

        // Add to pending updates
        const pendingUpdates = this.viewPendingUpdates.get(viewId);
        if (pendingUpdates) {
            pendingUpdates.add(taskPath);
        }

        // Clear existing timer
        const existingTimer = this.viewDebounceTimers.get(viewId);
        if (existingTimer) {
            clearTimeout(existingTimer);
        }

        // Schedule debounced update
        const timer = window.setTimeout(async () => {
            await this.processPendingUpdatesForView(viewId);
        }, config.debounceDelay);

        this.viewDebounceTimers.set(viewId, timer);
    }

    /**
     * Process pending updates for a specific view
     */
    private async processPendingUpdatesForView(viewId: string): Promise<void> {
        if (this.updateInProgress.has(viewId)) {
            console.log(`[ViewPerformanceService] Update already in progress for ${viewId}, skipping`);
            return;
        }

        const config = this.viewConfigs.get(viewId);
        const handler = this.viewHandlers.get(viewId);
        const pendingUpdates = this.viewPendingUpdates.get(viewId);

        if (!config || !handler || !pendingUpdates || pendingUpdates.size === 0) {
            return;
        }

        this.updateInProgress.add(viewId);

        try {
            const pathsToUpdate = Array.from(pendingUpdates);
            pendingUpdates.clear();

            console.log(`[ViewPerformanceService] Processing ${pathsToUpdate.length} updates for ${viewId}`);

            if (pathsToUpdate.length > config.maxBatchSize!) {
                // Too many updates, do full refresh
                console.log(`[ViewPerformanceService] Batch size exceeded for ${viewId}, doing full refresh`);
                await handler.refresh();
            } else {
                // Process selective updates
                for (const path of pathsToUpdate) {
                    await handler.updateForTask(path, 'update');
                }
            }

        } catch (error) {
            console.error(`[ViewPerformanceService] Error processing updates for ${viewId}:`, error);
            // Fallback to full refresh
            await handler.refresh();
        } finally {
            this.updateInProgress.delete(viewId);
            this.viewDebounceTimers.delete(viewId);
        }
    }

    /**
     * Trigger full refresh for all views (fallback)
     */
    private async triggerFullRefreshForAllViews(): Promise<void> {
        const refreshPromises: Promise<void>[] = [];

        for (const [viewId, handler] of this.viewHandlers) {
            if (!this.updateInProgress.has(viewId)) {
                refreshPromises.push(handler.refresh(true));
            }
        }

        await Promise.all(refreshPromises);
        this.lastGlobalRefreshTime = Date.now();
    }

    /**
     * Check if task has actually changed since last update
     */
    private hasTaskChanged(task: TaskInfo): boolean {
        const cachedVersion = this.globalTaskVersionCache.get(task.path);
        const currentVersion = task.dateModified || Date.now().toString();

        if (cachedVersion !== currentVersion) {
            this.globalTaskVersionCache.set(task.path, currentVersion);
            return true;
        }
        return false;
    }

    /**
     * Check if we need a full refresh vs selective update
     */
    shouldDoFullRefresh(): boolean {
        const timeSinceLastRefresh = Date.now() - this.lastGlobalRefreshTime;
        const cacheSize = this.globalTaskVersionCache.size;

        // Full refresh if:
        // - Haven't refreshed in 10+ minutes (stale cache)
        // - Significant change in task count (bulk operations)
        // - Cache seems corrupted
        return timeSinceLastRefresh > 10 * 60 * 1000 ||
               Math.abs(cacheSize - this.globalTaskCount) > 20 ||
               cacheSize === 0;
    }

    /**
     * Cleanup task version cache by removing entries for deleted tasks
     */
    private async cleanupTaskVersionCache(): Promise<void> {
        try {
            const allTaskPaths = this.plugin.cacheManager.getAllTaskPaths();
            const existingPaths = new Set(allTaskPaths);

            let removedCount = 0;
            for (const taskPath of this.globalTaskVersionCache.keys()) {
                if (!existingPaths.has(taskPath)) {
                    this.globalTaskVersionCache.delete(taskPath);
                    removedCount++;
                }
            }

            if (removedCount > 0) {
                console.log(`[ViewPerformanceService] Cleaned up ${removedCount} stale cache entries`);
            }

            // Update global task count
            this.globalTaskCount = existingPaths.size;

            // Fallback cleanup if cache gets too large
            if (this.globalTaskVersionCache.size > 2000) {
                console.log('[ViewPerformanceService] Cache too large, clearing for memory management');
                this.globalTaskVersionCache.clear();
                this.lastGlobalRefreshTime = 0;
            }

        } catch (error) {
            console.error('[ViewPerformanceService] Error during cache cleanup:', error);
        }
    }

    /**
     * Force refresh all views
     */
    async forceRefreshAll(): Promise<void> {
        this.globalTaskVersionCache.clear();
        await this.triggerFullRefreshForAllViews();
    }

    /**
     * Get performance statistics
     */
    getStats(): Record<string, any> {
        return {
            registeredViews: Array.from(this.viewConfigs.keys()),
            cacheSize: this.globalTaskVersionCache.size,
            activeUpdates: Array.from(this.updateInProgress),
            totalPendingUpdates: Array.from(this.viewPendingUpdates.values())
                .reduce((sum, set) => sum + set.size, 0),
            lastGlobalRefresh: new Date(this.lastGlobalRefreshTime).toISOString()
        };
    }

    /**
     * Cleanup when service is destroyed
     */
    destroy(): void {
        // Clean up global event listener
        if (this.eventListener) {
            this.plugin.emitter.offref(this.eventListener);
            this.eventListener = null;
        }

        // Clean up all timers
        for (const timer of this.viewDebounceTimers.values()) {
            clearTimeout(timer);
        }

        // Clear all state
        this.viewHandlers.clear();
        this.viewDebounceTimers.clear();
        this.viewPendingUpdates.clear();
        this.viewConfigs.clear();
        this.updateInProgress.clear();
        this.globalTaskVersionCache.clear();

        console.log('[ViewPerformanceService] Service destroyed');
    }
}