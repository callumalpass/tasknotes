import { FilterQuery, ViewFilterState, ViewPreferences, SavedView } from '../types';
import { EventEmitter } from '../utils/EventEmitter';
import { FilterUtils } from '../utils/FilterUtils';
import { App } from 'obsidian';
import type TaskNotesPlugin from '../main';

/**
 * Manages view-specific state like filter preferences across the application
 */
export class ViewStateManager extends EventEmitter {
    private filterState: ViewFilterState = {};
    private viewPreferences: ViewPreferences = {};
    private savedViews: SavedView[] = [];
    private storageKey = 'tasknotes-view-filter-state';
    private preferencesStorageKey = 'tasknotes-view-preferences';
    private savedViewsStorageKey = 'tasknotes-saved-views';
    private app: App;
    private plugin: TaskNotesPlugin;
    
    constructor(app: App, plugin: TaskNotesPlugin) {
        super();
        this.app = app;
        this.plugin = plugin;
        this.loadFromStorage();
        this.loadPreferencesFromStorage();
        // Note: migrateAndLoadSavedViews() is async and called separately during initialization
        this.savedViews = [...this.plugin.settings.savedViews];
    }

    /**
     * Initialize saved views with migration support (call this after construction)
     */
    async initializeSavedViews(): Promise<void> {
        await this.migrateAndLoadSavedViews();
    }

    /**
     * Get filter state for a specific view
     */
    getFilterState(viewType: string): FilterQuery | undefined {
        const state = this.filterState[viewType];
        
        if (!state) {
            return undefined;
        }
        
        // Check if state has the new FilterGroup structure (v3.13.0+)
        // If it's old format, ignore it and return undefined to use default
        if (typeof state !== 'object' ||
            state.type !== 'group' ||
            !Array.isArray(state.children) ||
            typeof state.conjunction !== 'string') {
            
            console.warn(`ViewStateManager: Ignoring old format filter state for ${viewType}, will use default`);
            // Clear the old format data
            delete this.filterState[viewType];
            this.saveToStorage();
            return undefined;
        }
        
        return FilterUtils.deepCloneFilterQuery(state);
    }

    /**
     * Set filter state for a specific view
     */
    setFilterState(viewType: string, query: FilterQuery): void {
        this.filterState[viewType] = FilterUtils.deepCloneFilterQuery(query);
        this.saveToStorage();
        this.emit('filter-state-changed', { viewType, query: FilterUtils.deepCloneFilterQuery(query) });
    }

    /**
     * Clear filter state for a specific view
     */
    clearFilterState(viewType: string): void {
        delete this.filterState[viewType];
        this.saveToStorage();
        this.emit('filter-state-cleared', { viewType });
    }

    /**
     * Clear all filter states
     */
    clearAllFilterStates(): void {
        this.filterState = {};
        this.saveToStorage();
        this.emit('all-filter-states-cleared');
    }

    /**
     * Get view preferences for a specific view
     */
    getViewPreferences<T = any>(viewType: string): T | undefined {
        return this.viewPreferences[viewType];
    }

    /**
     * Set view preferences for a specific view
     */
    setViewPreferences<T = any>(viewType: string, preferences: T): void {
        this.viewPreferences[viewType] = { ...preferences };
        this.savePreferencesToStorage();
        this.emit('view-preferences-changed', { viewType, preferences });
    }

    /**
     * Clear view preferences for a specific view
     */
    clearViewPreferences(viewType: string): void {
        delete this.viewPreferences[viewType];
        this.savePreferencesToStorage();
        this.emit('view-preferences-cleared', { viewType });
    }

    /**
     * Clear all view preferences
     */
    clearAllViewPreferences(): void {
        this.viewPreferences = {};
        this.savePreferencesToStorage();
        this.emit('all-view-preferences-cleared');
    }

    /**
     * Load state from localStorage
     */
    private loadFromStorage(): void {
        try {
            const stored = this.app.loadLocalStorage(this.storageKey);
            if (stored && typeof stored === 'string') {
                this.filterState = JSON.parse(stored);
            }
        } catch (error) {
            console.warn('Failed to load view filter state from storage:', error);
            this.filterState = {};
        }
    }

    /**
     * Save state to localStorage
     */
    private saveToStorage(): void {
        try {
            this.app.saveLocalStorage(this.storageKey, JSON.stringify(this.filterState));
        } catch (error) {
            console.warn('Failed to save view filter state to storage:', error);
        }
    }

    /**
     * Load view preferences from localStorage
     */
    private loadPreferencesFromStorage(): void {
        try {
            const stored = this.app.loadLocalStorage(this.preferencesStorageKey);
            if (stored && typeof stored === 'string') {
                this.viewPreferences = JSON.parse(stored);
            }
        } catch (error) {
            console.warn('Failed to load view preferences from storage:', error);
            this.viewPreferences = {};
        }
    }

    /**
     * Save view preferences to localStorage
     */
    private savePreferencesToStorage(): void {
        try {
            this.app.saveLocalStorage(this.preferencesStorageKey, JSON.stringify(this.viewPreferences));
        } catch (error) {
            console.warn('Failed to save view preferences to storage:', error);
        }
    }

    /**
     * Get all filter states (for debugging or export)
     */
    getAllFilterStates(): ViewFilterState {
        return { ...this.filterState };
    }

    // ============================================================================
    // SAVED VIEWS MANAGEMENT
    // ============================================================================

    /**
     * Get all saved views
     */
    getSavedViews(): SavedView[] {
        return this.savedViews.map(view => ({
            ...view,
            query: FilterUtils.deepCloneFilterQuery(view.query),
            viewOptions: view.viewOptions ? { ...view.viewOptions } : undefined
        }));
    }

    /**
     * Save a new view
     */
    saveView(name: string, query: FilterQuery, viewOptions?: {[key: string]: boolean}): SavedView {
        const view: SavedView = {
            id: this.generateId(),
            name,
            query: FilterUtils.deepCloneFilterQuery(query),
            viewOptions: viewOptions ? { ...viewOptions } : undefined
        };

        this.savedViews.push(view);
        this.saveSavedViewsToPluginData();
        this.emit('saved-views-changed', this.getSavedViews());
        
        return view;
    }

    /**
     * Update an existing saved view
     */
    updateView(viewId: string, updates: Partial<SavedView>): void {
        const viewIndex = this.savedViews.findIndex(v => v.id === viewId);
        if (viewIndex === -1) {
            throw new Error(`Saved view with ID ${viewId} not found`);
        }

        // Deep clone the query if it's being updated
        const clonedUpdates = { ...updates };
        if (clonedUpdates.query) {
            clonedUpdates.query = FilterUtils.deepCloneFilterQuery(clonedUpdates.query);
        }
        if (clonedUpdates.viewOptions) {
            clonedUpdates.viewOptions = { ...clonedUpdates.viewOptions };
        }

        this.savedViews[viewIndex] = {
            ...this.savedViews[viewIndex],
            ...clonedUpdates
        };

        this.saveSavedViewsToPluginData();
        this.emit('saved-views-changed', this.getSavedViews());
    }

    /**
     * Delete a saved view
     */
    deleteView(viewId: string): void {
        const viewIndex = this.savedViews.findIndex(v => v.id === viewId);
        if (viewIndex === -1) {
            throw new Error(`Saved view with ID ${viewId} not found`);
        }

        this.savedViews.splice(viewIndex, 1);
        this.saveSavedViewsToPluginData();
        this.emit('saved-views-changed', this.getSavedViews());
    }

    /**
     * Get a saved view by ID
     */
    getSavedView(viewId: string): SavedView | undefined {
        const view = this.savedViews.find(v => v.id === viewId);
        if (!view) return undefined;
        
        return {
            ...view,
            query: FilterUtils.deepCloneFilterQuery(view.query),
            viewOptions: view.viewOptions ? { ...view.viewOptions } : undefined
        };
    }

    /**
     * Clear all saved views
     */
    clearAllSavedViews(): void {
        this.savedViews = [];
        this.saveSavedViewsToPluginData();
        this.emit('saved-views-changed', this.getSavedViews());
    }

    /**
     * Reorder saved views by moving a view from one position to another
     */
    reorderSavedViews(fromIndex: number, toIndex: number): void {
        if (fromIndex < 0 || fromIndex >= this.savedViews.length || 
            toIndex < 0 || toIndex > this.savedViews.length || 
            fromIndex === toIndex) {
            return;
        }
        
        // Clamp toIndex to valid range
        toIndex = Math.min(toIndex, this.savedViews.length - 1);
        
        // Remove the view from its current position
        const [movedView] = this.savedViews.splice(fromIndex, 1);
        
        // Insert it at the new position
        this.savedViews.splice(toIndex, 0, movedView);
        
        // Save the reordered views
        this.saveSavedViewsToPluginData();
        this.emit('saved-views-changed', this.getSavedViews());
    }

    /**
     * Generate a unique ID for saved views
     */
    private generateId(): string {
        return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
    }

    /**
     * Migrate saved views from localStorage to plugin data, then load from plugin data
     */
    private async migrateAndLoadSavedViews(): Promise<void> {
        try {
            // First, load from plugin data (primary source)
            this.savedViews = [...this.plugin.settings.savedViews];
            
            // Check if we need to migrate from localStorage
            const localStorageData = this.app.loadLocalStorage(this.savedViewsStorageKey);
            if (localStorageData && typeof localStorageData === 'string' && this.savedViews.length === 0) {
                console.log('TaskNotes: Migrating saved views from localStorage to plugin data...');
                
                // Parse localStorage data
                const localStorageViews: SavedView[] = JSON.parse(localStorageData);
                
                // Migrate to plugin data
                this.savedViews = [...localStorageViews];
                await this.saveSavedViewsToPluginData();
                
                // Clear localStorage after successful migration
                this.app.saveLocalStorage(this.savedViewsStorageKey, null);
                
                console.log(`TaskNotes: Successfully migrated ${localStorageViews.length} saved views to plugin data.`);
            }
        } catch (error) {
            console.warn('Failed to load/migrate saved views:', error);
            this.savedViews = [];
        }
    }

    /**
     * Save saved views to plugin data (data.json)
     */
    private async saveSavedViewsToPluginData(): Promise<void> {
        try {
            // Update the plugin settings
            this.plugin.settings.savedViews = [...this.savedViews];
            
            // Save to data.json
            await this.plugin.saveSettings();
        } catch (error) {
            console.warn('Failed to save saved views to plugin data:', error);
        }
    }

    // ============================================================================
    // MIGRATION AND LEGACY SUPPORT
    // ============================================================================

    /**
     * Detect if migration is needed (saved views exist in localStorage but not in plugin data)
     */
    needsMigration(): boolean {
        const localStorageData = this.app.loadLocalStorage(this.savedViewsStorageKey);
        const hasLocalStorageData = !!localStorageData;
        const hasPluginData = this.plugin.settings.savedViews && this.plugin.settings.savedViews.length > 0;
        
        // Migration is needed if there's localStorage data but no plugin data
        return hasLocalStorageData && !hasPluginData;
    }

    /**
     * Perform one-time migration from legacy filter system
     */
    async performMigration(): Promise<void> {
        try {
            // Clear any old filter states since we're starting fresh
            this.clearAllFilterStates();
            
            // Migration of saved views is handled in migrateAndLoadSavedViews()
            await this.migrateAndLoadSavedViews();
            
            // Emit migration complete event
            this.emit('migration-complete');
        } catch (error) {
            console.error('Error during ViewStateManager migration:', error);
            // Fallback: ensure we have empty saved views
            this.savedViews = [];
            await this.saveSavedViewsToPluginData();
        }
    }

    /**
     * Clean up event listeners and clear state
     */
    cleanup(): void {
        // Remove all event listeners
        this.removeAllListeners();
    }
}