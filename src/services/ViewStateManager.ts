import { FilterQuery, ViewFilterState, ViewPreferences, SavedView } from '../types';
import { EventEmitter } from '../utils/EventEmitter';
import { App } from 'obsidian';

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
    
    constructor(app: App) {
        super();
        this.app = app;
        this.loadFromStorage();
        this.loadPreferencesFromStorage();
        this.loadSavedViewsFromStorage();
    }

    /**
     * Get filter state for a specific view
     */
    getFilterState(viewType: string): FilterQuery | undefined {
        return this.filterState[viewType];
    }

    /**
     * Set filter state for a specific view
     */
    setFilterState(viewType: string, query: FilterQuery): void {
        this.filterState[viewType] = { ...query };
        this.saveToStorage();
        this.emit('filter-state-changed', { viewType, query });
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
            if (stored) {
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
            if (stored) {
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
        return [...this.savedViews];
    }

    /**
     * Save a new view
     */
    saveView(name: string, query: FilterQuery): SavedView {
        const view: SavedView = {
            id: this.generateId(),
            name,
            query: { ...query }
        };

        this.savedViews.push(view);
        this.saveSavedViewsToStorage();
        this.emit('saved-views-changed', this.savedViews);
        
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

        this.savedViews[viewIndex] = {
            ...this.savedViews[viewIndex],
            ...updates
        };

        this.saveSavedViewsToStorage();
        this.emit('saved-views-changed', this.savedViews);
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
        this.saveSavedViewsToStorage();
        this.emit('saved-views-changed', this.savedViews);
    }

    /**
     * Get a saved view by ID
     */
    getSavedView(viewId: string): SavedView | undefined {
        return this.savedViews.find(v => v.id === viewId);
    }

    /**
     * Clear all saved views
     */
    clearAllSavedViews(): void {
        this.savedViews = [];
        this.saveSavedViewsToStorage();
        this.emit('saved-views-changed', this.savedViews);
    }

    /**
     * Generate a unique ID for saved views
     */
    private generateId(): string {
        return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
    }

    /**
     * Load saved views from localStorage
     */
    private loadSavedViewsFromStorage(): void {
        try {
            const stored = this.app.loadLocalStorage(this.savedViewsStorageKey);
            if (stored) {
                this.savedViews = JSON.parse(stored);
            }
        } catch (error) {
            console.warn('Failed to load saved views from storage:', error);
            this.savedViews = [];
        }
    }

    /**
     * Save saved views to localStorage
     */
    private saveSavedViewsToStorage(): void {
        try {
            this.app.saveLocalStorage(this.savedViewsStorageKey, JSON.stringify(this.savedViews));
        } catch (error) {
            console.warn('Failed to save saved views to storage:', error);
        }
    }

    // ============================================================================
    // MIGRATION AND LEGACY SUPPORT
    // ============================================================================

    /**
     * Detect if migration is needed (no saved views structure exists)
     */
    needsMigration(): boolean {
        const stored = this.app.loadLocalStorage(this.savedViewsStorageKey);
        return !stored;
    }

    /**
     * Perform one-time migration from legacy filter system
     */
    performMigration(): void {
        // Clear any old filter states since we're starting fresh
        this.clearAllFilterStates();
        
        // Initialize empty saved views
        this.savedViews = [];
        this.saveSavedViewsToStorage();
        
        // Emit migration complete event
        this.emit('migration-complete');
    }

    /**
     * Clean up event listeners and clear state
     */
    cleanup(): void {
        // Remove all event listeners
        this.removeAllListeners();
    }
}