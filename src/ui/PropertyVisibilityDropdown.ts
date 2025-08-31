import { Menu, App } from 'obsidian';
import type TaskNotesPlugin from '../main';
import type { SavedView } from '../types';

interface PropertyDefinition {
    id: string;
    name: string;
    category: 'core' | 'organization' | 'user';
}

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
            console.log('PropertyVisibilityDropdown: Creating menu...');
            const menu = new Menu();
            
            // Use the current properties passed to constructor
            const currentProperties = this.currentProperties;
            console.log('PropertyVisibilityDropdown: Current properties:', currentProperties);
            
            const allProperties = this.getAllAvailableProperties();
            console.log('PropertyVisibilityDropdown: All properties:', allProperties);
            
            // Add property groups (Bases-style)
            this.addPropertyGroup(menu, 'CORE PROPERTIES', 
                allProperties.filter(p => p.category === 'core'), 
                currentProperties);
                
            this.addPropertyGroup(menu, 'ORGANIZATION', 
                allProperties.filter(p => p.category === 'organization'), 
                currentProperties);
            
            const userProperties = allProperties.filter(p => p.category === 'user');
            if (userProperties.length > 0) {
                this.addPropertyGroup(menu, 'CUSTOM PROPERTIES', userProperties, currentProperties);
            }
            
            console.log('PropertyVisibilityDropdown: Showing menu at coordinates:', event.clientX, event.clientY);
            
            // Try both methods to show the menu
            if (menu.showAtMouseEvent) {
                menu.showAtMouseEvent(event);
            } else if (menu.showAtPosition) {
                menu.showAtPosition({ x: event.clientX, y: event.clientY });
            } else {
                console.error('PropertyVisibilityDropdown: Menu has no show method');
            }
            
            console.log('PropertyVisibilityDropdown: Menu shown successfully');
        } catch (error) {
            console.error('PropertyVisibilityDropdown: Error showing menu:', error);
            console.error('PropertyVisibilityDropdown: Stack trace:', error.stack);
        }
    }
    
    private getDefaultProperties(): string[] {
        return [
            'status',      // Status dot
            'priority',    // Priority dot
            'due',         // Due date
            'scheduled',   // Scheduled date
            'projects',    // Projects
            'contexts',    // Contexts
            'tags'         // Tags
        ];
    }
    
    private getAllAvailableProperties(): PropertyDefinition[] {
        const properties: PropertyDefinition[] = [];
        
        // Core properties (including status and priority dots)
        properties.push(
            { id: 'status', name: 'Status Dot', category: 'core' },
            { id: 'priority', name: 'Priority Dot', category: 'core' },
            { id: 'due', name: 'Due Date', category: 'core' },
            { id: 'scheduled', name: 'Scheduled Date', category: 'core' },
            { id: 'timeEstimate', name: 'Time Estimate', category: 'core' },
            { id: 'totalTrackedTime', name: 'Total Tracked Time', category: 'core' },
            { id: 'recurrence', name: 'Recurrence', category: 'core' },
            { id: 'completedDate', name: 'Completed Date', category: 'core' },
            { id: 'file.ctime', name: 'Created Date', category: 'core' },
            { id: 'file.mtime', name: 'Modified Date', category: 'core' }
        );
        
        // Organization properties
        properties.push(
            { id: 'projects', name: 'Projects', category: 'organization' },
            { id: 'contexts', name: 'Contexts', category: 'organization' },
            { id: 'tags', name: 'Tags', category: 'organization' }
        );
        
        // User-defined properties
        const userFields = this.plugin.settings.userFields || [];
        for (const field of userFields) {
            properties.push({
                id: `user:${field.id}`,
                name: field.displayName,
                category: 'user'
            });
        }
        
        return properties;
    }
    
    private addPropertyGroup(
        menu: Menu,
        groupName: string,
        properties: PropertyDefinition[],
        currentProperties: string[]
    ): void {
        if (properties.length === 0) return;
        
        menu.addSeparator();
        
        // Group header
        menu.addItem((item) => {
            item.setTitle(groupName);
            item.setDisabled(true);
        });
        
        // Property toggles
        for (const property of properties) {
            const isVisible = currentProperties.includes(property.id);
            
            menu.addItem((item) => {
                item.setTitle(property.name);
                item.setIcon(isVisible ? 'check-square' : 'square');
                item.onClick(() => {
                    this.toggleProperty(property.id, currentProperties);
                });
            });
        }
    }
    
    private toggleProperty(propertyId: string, currentProperties: string[]): void {
        let newProperties: string[];
        
        if (currentProperties.includes(propertyId)) {
            // Remove property
            newProperties = currentProperties.filter(id => id !== propertyId);
        } else {
            // Add property
            newProperties = [...currentProperties, propertyId];
        }
        
        this.onUpdate(newProperties);
    }
}