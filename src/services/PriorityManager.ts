import { PriorityConfig } from '../types';

/**
 * Service for managing custom task priorities
 */
export class PriorityManager {
    constructor(private priorities: PriorityConfig[]) {}

    /**
     * Normalize priority value to string for comparison
     */
    private normalizeValue(value: string | number | undefined): string {
        if (value === undefined || value === null) return '';
        return String(value);
    }

    /**
     * Get priority configuration by value (supports both string and number)
     */
    getPriorityConfig(value: string | number | undefined): PriorityConfig | undefined {
        if (value === undefined || value === null) return undefined;
        const normalizedValue = this.normalizeValue(value);
        return this.priorities.find(p => this.normalizeValue(p.value) === normalizedValue);
    }

    /**
     * Get priorities ordered by weight (highest weight first)
     */
    getPrioritiesByWeight(): PriorityConfig[] {
        return [...this.priorities].sort((a, b) => b.weight - a.weight);
    }

    /**
     * Get priorities ordered by weight (lowest weight first)
     */
    getPrioritiesByWeightAsc(): PriorityConfig[] {
        return [...this.priorities].sort((a, b) => a.weight - b.weight);
    }

    /**
     * Get next priority in cycle (cycling by weight order)
     */
    getNextPriority(currentPriority: string | number): string | number {
        const sortedPriorities = this.getPrioritiesByWeightAsc();
        const normalizedCurrent = this.normalizeValue(currentPriority);
        const currentIndex = sortedPriorities.findIndex(p => this.normalizeValue(p.value) === normalizedCurrent);
        
        if (currentIndex === -1) {
            // Current priority not found, return first priority
            return sortedPriorities[0]?.value || 'normal';
        }
        
        // Get next priority, cycling to first if at end
        const nextIndex = (currentIndex + 1) % sortedPriorities.length;
        return sortedPriorities[nextIndex].value;
    }

    /**
     * Compare priorities for sorting (higher weight = higher priority)
     * Returns negative if a has lower priority, positive if higher, 0 if equal
     */
    comparePriorities(a: string | number, b: string | number): number {
        const priorityA = this.getPriorityConfig(a);
        const priorityB = this.getPriorityConfig(b);
        
        // Default weight if priority not found
        const weightA = priorityA?.weight || 0;
        const weightB = priorityB?.weight || 0;
        
        return weightB - weightA; // Higher weight comes first
    }

    /**
     * Get CSS variables for priority colors
     */
    getPriorityStyles(): string {
        const cssRules: string[] = [];
        
        for (const priority of this.priorities) {
            const cssClass = `--priority-${String(priority.value).replace(/[^a-zA-Z0-9-]/g, '-')}-color`;
            cssRules.push(`${cssClass}: ${priority.color};`);
        }
        
        return `:root { ${cssRules.join(' ')} }`;
    }

    /**
     * Get all priority configurations
     */
    getAllPriorities(): PriorityConfig[] {
        return [...this.priorities];
    }

    /**
     * Update priority configurations
     */
    updatePriorities(newPriorities: PriorityConfig[]): void {
        this.priorities = newPriorities;
    }

    /**
     * Get the highest priority value (highest weight)
     */
    getHighestPriority(): string | number | undefined {
        const sorted = this.getPrioritiesByWeight();
        return sorted[0]?.value;
    }

    /**
     * Get the lowest priority value (lowest weight)
     */
    getLowestPriority(): string | number | undefined {
        const sorted = this.getPrioritiesByWeightAsc();
        return sorted[0]?.value;
    }

    /**
     * Get priority weight for sorting
     */
    getPriorityWeight(priority: string | number): number {
        const config = this.getPriorityConfig(priority);
        return config?.weight || 0;
    }

    /**
     * Check if priority A is higher than priority B
     */
    isHigherPriority(a: string | number, b: string | number): boolean {
        return this.comparePriorities(a, b) > 0;
    }

    /**
     * Validate priority configuration
     */
    static validatePriorities(priorities: PriorityConfig[]): { valid: boolean; errors: string[] } {
        const errors: string[] = [];

        // At least 1 priority required
        if (priorities.length < 1) {
            errors.push('At least 1 priority is required');
        }

        // Check for unique priority values
        const values = priorities.map(p => p.value);
        const uniqueValues = new Set(values);
        if (values.length !== uniqueValues.size) {
            errors.push('Priority values must be unique');
        }

        // Check for unique IDs
        const ids = priorities.map(p => p.id);
        const uniqueIds = new Set(ids);
        if (ids.length !== uniqueIds.size) {
            errors.push('Priority IDs must be unique');
        }

        // Check for unique weights
        const weights = priorities.map(p => p.weight);
        const uniqueWeights = new Set(weights);
        if (weights.length !== uniqueWeights.size) {
            errors.push('Priority weights must be unique');
        }

        // Check for empty values and labels
        for (const priority of priorities) {
            if (priority.value === undefined || priority.value === null || String(priority.value).trim() === '') {
                errors.push('Priority values cannot be empty');
                break;
            }
            if (!priority.label || String(priority.label).trim() === '') {
                errors.push('Priority labels cannot be empty');
                break;
            }
            if (!priority.color || !priority.color.match(/^#[0-9a-fA-F]{6}$/)) {
                errors.push('Priority colors must be valid hex colors (#rrggbb)');
                break;
            }
            if (typeof priority.weight !== 'number' || priority.weight < 0) {
                errors.push('Priority weights must be non-negative numbers');
                break;
            }
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }

    /**
     * Generate a new unique priority ID
     */
    static generatePriorityId(existingPriorities: PriorityConfig[]): string {
        const existingIds = new Set(existingPriorities.map(p => p.id));
        let counter = 1;
        let id = `priority-${counter}`;
        
        while (existingIds.has(id)) {
            counter++;
            id = `priority-${counter}`;
        }
        
        return id;
    }

    /**
     * Generate a new unique weight value
     */
    static generatePriorityWeight(existingPriorities: PriorityConfig[]): number {
        const existingWeights = existingPriorities.map(p => p.weight);
        if (existingWeights.length === 0) return 1;
        
        return Math.max(...existingWeights) + 1;
    }

    /**
     * Create a new priority with default values
     */
    static createDefaultPriority(existingPriorities: PriorityConfig[]): PriorityConfig {
        const id = PriorityManager.generatePriorityId(existingPriorities);
        const weight = PriorityManager.generatePriorityWeight(existingPriorities);
        
        return {
            id,
            value: 'new-priority',
            label: 'New priority',
            color: '#808080',
            weight
        };
    }
}