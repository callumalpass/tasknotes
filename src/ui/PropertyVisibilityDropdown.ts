import { Menu } from 'obsidian';
import type TaskNotesPlugin from '../main';

interface PropertyDefinition {
    id: string;
    name: string;
    category: 'core' | 'organization' | 'user';
}

/**
 * Cache for property definitions to avoid repeated calculation
 */
let propertiesCache: PropertyDefinition[] | null = null;
let cacheValidForPlugin: TaskNotesPlugin | null = null;

/**
 * Dropdown component for configuring visible properties on task cards
 * Similar to Obsidian Bases property selection UI
 */
export class PropertyVisibilityDropdown {
    constructor(
        private currentProperties: string[],
        private plugin: TaskNotesPlugin,
        private onUpdate: (properties: string[]) => void
    ) {}

    public show(event: MouseEvent): void {
        try {
            const menu = new Menu();
            const allProperties = this.getCachedProperties();
            
            // Pre-compute property groups for better performance
            const propertyGroups = this.groupProperties(allProperties);
            
            // Add property groups efficiently
            this.addPropertyGroup(menu, 'CORE PROPERTIES', propertyGroups.core);
            this.addPropertyGroup(menu, 'ORGANIZATION', propertyGroups.organization);
            
            if (propertyGroups.user.length > 0) {
                this.addPropertyGroup(menu, 'CUSTOM PROPERTIES', propertyGroups.user);
            }
            
            // Show menu using the most reliable method
            this.showMenu(menu, event);
            
        } catch (error) {
            console.error('PropertyVisibilityDropdown: Error showing menu:', error);
            // Provide user feedback on error
            this.plugin.app.workspace.trigger('notice', 'Failed to show properties menu');
        }
    }
    
    /**
     * Show menu using the most reliable method available
     */
    private showMenu(menu: Menu, event: MouseEvent): void {
        if (menu.showAtMouseEvent) {
            menu.showAtMouseEvent(event);
        } else if (menu.showAtPosition) {
            menu.showAtPosition({ x: event.clientX, y: event.clientY });
        } else {
            console.error('PropertyVisibilityDropdown: No menu show method available');
        }
    }
    
    /**
     * Get cached properties or compute them if cache is invalid
     */
    private getCachedProperties(): PropertyDefinition[] {
        if (propertiesCache && cacheValidForPlugin === this.plugin) {
            return propertiesCache;
        }
        
        propertiesCache = this.computeAvailableProperties();
        cacheValidForPlugin = this.plugin;
        return propertiesCache;
    }
    
    /**
     * Group properties by category for efficient rendering
     */
    private groupProperties(properties: PropertyDefinition[]): Record<string, PropertyDefinition[]> {
        const groups: Record<string, PropertyDefinition[]> = {
            core: [],
            organization: [],
            user: []
        };
        
        for (const property of properties) {
            groups[property.category].push(property);
        }
        
        return groups;
    }
    
    /**
     * Compute available properties (not cached)
     */
    private computeAvailableProperties(): PropertyDefinition[] {
        const properties: PropertyDefinition[] = [];
        
        // Core properties - use array spread for better performance
        properties.push(...[
            { id: 'status', name: 'Status Dot', category: 'core' as const },
            { id: 'priority', name: 'Priority Dot', category: 'core' as const },
            { id: 'due', name: 'Due Date', category: 'core' as const },
            { id: 'scheduled', name: 'Scheduled Date', category: 'core' as const },
            { id: 'timeEstimate', name: 'Time Estimate', category: 'core' as const },
            { id: 'totalTrackedTime', name: 'Total Tracked Time', category: 'core' as const },
            { id: 'recurrence', name: 'Recurrence', category: 'core' as const },
            { id: 'completedDate', name: 'Completed Date', category: 'core' as const },
            { id: 'file.ctime', name: 'Created Date', category: 'core' as const },
            { id: 'file.mtime', name: 'Modified Date', category: 'core' as const }
        ]);
        
        // Organization properties
        properties.push(...[
            { id: 'projects', name: 'Projects', category: 'organization' as const },
            { id: 'contexts', name: 'Contexts', category: 'organization' as const },
            { id: 'tags', name: 'Tags', category: 'organization' as const }
        ]);
        
        // User-defined properties with error handling
        this.addUserProperties(properties);
        
        return properties;
    }
    
    /**
     * Add user-defined properties with error handling
     */
    private addUserProperties(properties: PropertyDefinition[]): void {
        try {
            const userFields = this.plugin.settings.userFields || [];
            for (const field of userFields) {
                if (field.id && field.displayName) {
                    properties.push({
                        id: `user:${field.id}`,
                        name: field.displayName,
                        category: 'user'
                    });
                }
            }
        } catch (error) {
            console.warn('PropertyVisibilityDropdown: Error loading user properties:', error);
        }
    }
    
    private addPropertyGroup(
        menu: Menu,
        groupName: string,
        properties: PropertyDefinition[]
    ): void {
        if (properties.length === 0) return;
        
        menu.addSeparator();
        
        // Group header
        menu.addItem((item) => {
            item.setTitle(groupName);
            item.setDisabled(true);
        });
        
        // Pre-compute visibility for performance
        const visibilityMap = new Set(this.currentProperties);
        
        // Property toggles with optimized visibility check
        for (const property of properties) {
            const isVisible = visibilityMap.has(property.id);
            
            menu.addItem((item) => {
                item.setTitle(property.name);
                item.setIcon(isVisible ? 'check-square' : 'square');
                item.onClick(() => {
                    this.toggleProperty(property.id);
                });
            });
        }
    }
    
    private toggleProperty(propertyId: string): void {
        try {
            const currentSet = new Set(this.currentProperties);
            
            if (currentSet.has(propertyId)) {
                currentSet.delete(propertyId);
            } else {
                currentSet.add(propertyId);
            }
            
            const newProperties = Array.from(currentSet);
            this.onUpdate(newProperties);
        } catch (error) {
            console.error('PropertyVisibilityDropdown: Error toggling property:', error);
        }
    }
}

/**
 * Clear the properties cache (call when user fields change)
 */
export function clearPropertiesCache(): void {
    propertiesCache = null;
    cacheValidForPlugin = null;
}