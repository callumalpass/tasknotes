import { FilterQuery, ViewFilterState, ViewPreferences } from '../types';
import { EventEmitter } from '../utils/EventEmitter';
import { App } from 'obsidian';

/**
 * Manages view-specific state like filter preferences across the application
 */
export class ViewStateManager extends EventEmitter {
    private filterState: ViewFilterState = {};
    private viewPreferences: ViewPreferences = {};
    private storageKey = 'tasknotes-view-filter-state';
    private preferencesStorageKey = 'tasknotes-view-preferences';
    private app: App;
    
    constructor(app: App) {
        super();
        this.app = app;
        this.loadFromStorage();
        this.loadPreferencesFromStorage();
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
    

    /**
     * Clean up event listeners and clear state
     */
    cleanup(): void {
        // Remove all event listeners
        this.removeAllListeners();
    }
}