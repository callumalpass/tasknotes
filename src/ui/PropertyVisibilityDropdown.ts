import { Menu } from 'obsidian';
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
        private currentSavedView: SavedView | null,
        private plugin: TaskNotesPlugin,
        private onUpdate: (properties: string[]) => void
    ) {}

    public show(event: MouseEvent): void {
        const menu = new Menu();
        
        // Get current visible properties
        const currentProperties = this.getCurrentVisibleProperties();
        const allProperties = this.getAllAvailableProperties();
        
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
        
        menu.showAtMouseEvent(event);
    }
    
    private getCurrentVisibleProperties(): string[] {
        // Check saved view first
        if (this.currentSavedView?.visibleProperties) {
            return this.currentSavedView.visibleProperties;
        }
        
        // Fall back to global defaults
        if (this.plugin.settings.defaultVisibleProperties) {
            return this.plugin.settings.defaultVisibleProperties;
        }
        
        // Ultimate fallback
        return this.getDefaultProperties();
    }
    
    private getDefaultProperties(): string[] {
        return [
            'due',         // Due date
            'scheduled',   // Scheduled date
            'projects',    // Projects
            'contexts',    // Contexts
            'tags'         // Tags
        ];
    }
    
    private getAllAvailableProperties(): PropertyDefinition[] {
        const properties: PropertyDefinition[] = [];
        
        // Core properties
        properties.push(
            { id: 'due', name: 'Due Date', category: 'core' },
            { id: 'scheduled', name: 'Scheduled Date', category: 'core' },
            { id: 'timeEstimate', name: 'Time Estimate', category: 'core' },
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