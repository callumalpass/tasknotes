import { FilterQuery, TaskInfo, TaskSortKey, TaskGroupKey, SortDirection, FilterCondition, FilterGroup, FilterProperty, FilterOperator, FILTER_PROPERTIES, FILTER_OPERATORS } from '../types';
import { parseLinktext } from 'obsidian';
import { MinimalNativeCache } from '../utils/MinimalNativeCache';
import { StatusManager } from './StatusManager';
import { PriorityManager } from './PriorityManager';
import { EventEmitter } from '../utils/EventEmitter';
import { isDueByRRule, filterEmptyProjects } from '../utils/helpers';
import { format, isToday } from 'date-fns';
import { 
    getTodayString, 
    isBeforeDateSafe, 
    isSameDateSafe, 
    startOfDayForDateString, 
    isToday as isTodayUtil,
    isBeforeDateTimeAware,
    isOverdueTimeAware,
    getDatePart
} from '../utils/dateUtils';

/**
 * Unified filtering, sorting, and grouping service for all task views.
 * Provides performance-optimized data retrieval using CacheManager indexes.
 */
export class FilterService extends EventEmitter {
    private cacheManager: MinimalNativeCache;
    private statusManager: StatusManager;
    private priorityManager: PriorityManager;

    constructor(
        cacheManager: MinimalNativeCache,
        statusManager: StatusManager,
        priorityManager: PriorityManager
    ) {
        super();
        this.cacheManager = cacheManager;
        this.statusManager = statusManager;
        this.priorityManager = priorityManager;
    }

    /**
     * Main method to get filtered, sorted, and grouped tasks
     * Handles the new advanced FilterQuery structure with nested conditions and groups
     */
    async getGroupedTasks(query: FilterQuery, targetDate?: Date): Promise<Map<string, TaskInfo[]>> {
        // Get all tasks (we can optimize this later with smarter indexing)
        let allTaskPaths = this.cacheManager.getAllTaskPaths();
        
        // Convert paths to TaskInfo objects
        const allTasks = await this.pathsToTaskInfos(Array.from(allTaskPaths));
        
        // Filter tasks using the new recursive evaluation
        const filteredTasks = allTasks.filter(task => this.evaluateFilterNode(query, task));
        
        // Sort the filtered results
        const sortedTasks = this.sortTasks(filteredTasks, query.sortKey || 'due', query.sortDirection || 'asc');
        
        // Group the sorted results
        return this.groupTasks(sortedTasks, query.groupKey || 'none', targetDate);
    }

    /**
     * Convert task paths to TaskInfo objects
     */
    private async pathsToTaskInfos(paths: string[]): Promise<TaskInfo[]> {
        const tasks: TaskInfo[] = [];
        const batchSize = 50;
        
        for (let i = 0; i < paths.length; i += batchSize) {
            const batch = paths.slice(i, i + batchSize);
            const batchTasks = await Promise.all(
                batch.map(path => this.cacheManager.getCachedTaskInfo(path))
            );
            
            for (const task of batchTasks) {
                if (task) {
                    tasks.push(task);
                }
            }
        }
        
        return tasks;
    }

    /**
     * Recursively evaluate a filter node (group or condition) against a task
     * Returns true if the task matches the filter criteria
     */
    private evaluateFilterNode(node: FilterGroup | FilterCondition, task: TaskInfo): boolean {
        if (node.type === 'condition') {
            return this.evaluateCondition(node, task);
        } else if (node.type === 'group') {
            return this.evaluateGroup(node, task);
        }
        return true; // Default to true if unknown node type
    }

    /**
     * Evaluate a filter group against a task
     */
    private evaluateGroup(group: FilterGroup, task: TaskInfo): boolean {
        if (group.children.length === 0) {
            return true; // Empty group matches everything
        }

        if (group.conjunction === 'and') {
            // All children must match
            return group.children.every(child => this.evaluateFilterNode(child, task));
        } else if (group.conjunction === 'or') {
            // At least one child must match
            return group.children.some(child => this.evaluateFilterNode(child, task));
        }

        return true; // Default to true if unknown conjunction
    }

    /**
     * Evaluate a single filter condition against a task
     */
    private evaluateCondition(condition: FilterCondition, task: TaskInfo): boolean {
        const { property, operator, value } = condition;
        
        // Get the actual value from the task
        const taskValue = this.getTaskPropertyValue(task, property);
        
        // Apply the operator
        return this.applyOperator(taskValue, operator as FilterOperator, value);
    }

    /**
     * Get the value of a specific property from a task
     */
    private getTaskPropertyValue(task: TaskInfo, property: string): any {
        switch (property) {
            case 'title':
                return task.title;
            case 'status':
                return task.status;
            case 'priority':
                return task.priority;
            case 'tags':
                return task.tags || [];
            case 'contexts':
                return task.contexts || [];
            case 'projects':
                return task.projects || [];
            case 'due':
                return task.due;
            case 'scheduled':
                return task.scheduled;
            case 'completedDate':
                return task.completedDate;
            case 'file.ctime':
                return task.dateCreated;
            case 'file.mtime':
                return task.dateModified;
            case 'archived':
                return task.archived;
            case 'timeEstimate':
                return task.timeEstimate;
            case 'recurrence':
                return task.recurrence;
            case 'status.isCompleted':
                return this.statusManager.isCompletedStatus(task.status);
            default:
                return undefined;
        }
    }

    /**
     * Apply a filter operator to compare task value with condition value
     */
    private applyOperator(taskValue: any, operator: FilterOperator, conditionValue: any): boolean {
        switch (operator) {
            case 'is':
                return this.isEqual(taskValue, conditionValue);
            case 'is-not':
                return !this.isEqual(taskValue, conditionValue);
            case 'contains':
                return this.contains(taskValue, conditionValue);
            case 'does-not-contain':
                return !this.contains(taskValue, conditionValue);
            case 'is-before':
                return this.isBefore(taskValue, conditionValue);
            case 'is-after':
                return this.isAfter(taskValue, conditionValue);
            case 'is-on-or-before':
                return this.isOnOrBefore(taskValue, conditionValue);
            case 'is-on-or-after':
                return this.isOnOrAfter(taskValue, conditionValue);
            case 'is-empty':
                return this.isEmpty(taskValue);
            case 'is-not-empty':
                return !this.isEmpty(taskValue);
            case 'is-checked':
                return taskValue === true;
            case 'is-not-checked':
                return taskValue !== true;
            case 'is-greater-than':
                return this.isGreaterThan(taskValue, conditionValue);
            case 'is-less-than':
                return this.isLessThan(taskValue, conditionValue);
            default:
                return true;
        }
    }

    /**
     * Equality comparison that handles arrays and different value types
     */
    private isEqual(taskValue: any, conditionValue: any): boolean {
        if (Array.isArray(taskValue)) {
            if (Array.isArray(conditionValue)) {
                // Both arrays: check if any task value matches any condition value
                return taskValue.some(tv => conditionValue.includes(tv));
            } else {
                // Task has array, condition is single value
                return taskValue.includes(conditionValue);
            }
        } else {
            if (Array.isArray(conditionValue)) {
                // Task has single value, condition is array
                return conditionValue.includes(taskValue);
            } else {
                // Both single values
                return taskValue === conditionValue;
            }
        }
    }

    /**
     * Contains comparison for text and arrays
     */
    private contains(taskValue: any, conditionValue: any): boolean {
        if (Array.isArray(taskValue)) {
            if (Array.isArray(conditionValue)) {
                // Both arrays: check if any condition value is contained in task values
                return conditionValue.some(cv => taskValue.includes(cv));
            } else {
                // Task has array, condition is single value
                return taskValue.includes(conditionValue);
            }
        } else if (typeof taskValue === 'string') {
            if (Array.isArray(conditionValue)) {
                // Task has string, condition is array
                return conditionValue.some(cv => taskValue.toLowerCase().includes(cv.toLowerCase()));
            } else {
                // Both strings
                return taskValue.toLowerCase().includes(conditionValue.toLowerCase());
            }
        }
        return false;
    }

    /**
     * Date comparison: is task value before condition value
     */
    private isBefore(taskValue: any, conditionValue: any): boolean {
        if (!taskValue || !conditionValue) return false;
        try {
            return isBeforeDateTimeAware(taskValue, conditionValue);
        } catch {
            return false;
        }
    }

    /**
     * Date comparison: is task value after condition value
     */
    private isAfter(taskValue: any, conditionValue: any): boolean {
        if (!taskValue || !conditionValue) return false;
        try {
            return isBeforeDateTimeAware(conditionValue, taskValue);
        } catch {
            return false;
        }
    }

    /**
     * Date comparison: is task value on or before condition value
     */
    private isOnOrBefore(taskValue: any, conditionValue: any): boolean {
        if (!taskValue || !conditionValue) return false;
        try {
            return isBeforeDateTimeAware(taskValue, conditionValue) || isSameDateSafe(getDatePart(taskValue), getDatePart(conditionValue));
        } catch {
            return false;
        }
    }

    /**
     * Date comparison: is task value on or after condition value  
     */
    private isOnOrAfter(taskValue: any, conditionValue: any): boolean {
        if (!taskValue || !conditionValue) return false;
        try {
            return isBeforeDateTimeAware(conditionValue, taskValue) || isSameDateSafe(getDatePart(taskValue), getDatePart(conditionValue));
        } catch {
            return false;
        }
    }

    /**
     * Check if value is empty (null, undefined, empty string, empty array)
     */
    private isEmpty(value: any): boolean {
        if (value === null || value === undefined) return true;
        if (typeof value === 'string') return value.trim() === '';
        if (Array.isArray(value)) return value.length === 0;
        return false;
    }

    /**
     * Numeric comparison: is task value greater than condition value
     */
    private isGreaterThan(taskValue: any, conditionValue: any): boolean {
        const taskNum = typeof taskValue === 'number' ? taskValue : parseFloat(taskValue);
        const conditionNum = typeof conditionValue === 'number' ? conditionValue : parseFloat(conditionValue);
        if (isNaN(taskNum) || isNaN(conditionNum)) return false;
        return taskNum > conditionNum;
    }

    /**
     * Numeric comparison: is task value less than condition value
     */
    private isLessThan(taskValue: any, conditionValue: any): boolean {
        const taskNum = typeof taskValue === 'number' ? taskValue : parseFloat(taskValue);
        const conditionNum = typeof conditionValue === 'number' ? conditionValue : parseFloat(conditionValue);
        if (isNaN(taskNum) || isNaN(conditionNum)) return false;
        return taskNum < conditionNum;
    }


    /**
     * Get task paths within a date range
     */
    private async getTaskPathsInDateRange(startDate: string, endDate: string): Promise<Set<string>> {
        const pathsInRange = new Set<string>();
        const start = new Date(startDate);
        const end = new Date(endDate);

        // Get tasks with due dates in the range (existing logic)
        for (let date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) {
            const dateStr = format(date, 'yyyy-MM-dd'); // CORRECT: Uses local timezone
            const pathsForDate = this.cacheManager.getTaskPathsByDate(dateStr);
            pathsForDate.forEach(path => pathsInRange.add(path));
        }

        // Also check recurring tasks without due dates to see if they should appear in this range
        const allTaskPaths = this.cacheManager.getAllTaskPaths();
        
        // Process paths in batches for better performance
        const batchSize = 50;
        const pathArray = Array.from(allTaskPaths);
        
        for (let i = 0; i < pathArray.length; i += batchSize) {
            const batch = pathArray.slice(i, i + batchSize);
            const batchTasks = await Promise.all(
                batch.map(path => this.cacheManager.getCachedTaskInfo(path))
            );
            
            for (const task of batchTasks) {
                if (task && task.recurrence && !task.due) {
                    // Check if this recurring task should appear on any date in the range
                    for (let date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) {
                        if (isDueByRRule(task, date)) {
                            pathsInRange.add(task.path);
                            break; // No need to check more dates once we find a match
                        }
                    }
                }
            }
        }

        return pathsInRange;
    }

    /**
     * Get overdue task paths efficiently using the dedicated index
     */
    getOverdueTaskPaths(): Set<string> {
        return this.cacheManager.getOverdueTaskPaths();
    }

    /**
     * Combine multiple task path sets (e.g., date range + overdue)
     */
    private combineTaskPathSets(sets: Set<string>[]): Set<string> {
        const combined = new Set<string>();
        sets.forEach(set => {
            set.forEach(path => combined.add(path));
        });
        return combined;
    }


    /**
     * Check if a date string falls within a date range (inclusive)
     * Works with both date-only and datetime strings
     */
    private isDateInRange(dateString: string, startDateString: string, endDateString: string): boolean {
        try {
            // Extract date parts for range comparison
            const datePart = getDatePart(dateString);
            const startDatePart = getDatePart(startDateString);
            const endDatePart = getDatePart(endDateString);
            
            const date = startOfDayForDateString(datePart);
            const startDate = startOfDayForDateString(startDatePart);
            const endDate = startOfDayForDateString(endDatePart);
            
            return date >= startDate && date <= endDate;
        } catch (error) {
            console.error('Error checking date range:', { dateString, startDateString, endDateString, error });
            return false;
        }
    }

    /**
     * Check if a Date object represents the same day as a date string
     */
    private isSameDayAs(dateObj: Date, dateString: string): boolean {
        try {
            const dateObjNormalized = new Date(dateObj);
            dateObjNormalized.setHours(0, 0, 0, 0);
            const targetDate = startOfDayForDateString(dateString);
            return dateObjNormalized.getTime() === targetDate.getTime();
        } catch (error) {
            console.error('Error comparing date object with date string:', { dateObj, dateString, error });
            return false;
        }
    }


    /**
     * Sort tasks by specified criteria
     */
    private sortTasks(tasks: TaskInfo[], sortKey: TaskSortKey, direction: SortDirection): TaskInfo[] {
        return tasks.sort((a, b) => {
            let comparison = 0;

            // Primary sort criteria
            switch (sortKey) {
                case 'due':
                    comparison = this.compareDates(a.due, b.due);
                    break;
                case 'scheduled':
                    comparison = this.compareDates(a.scheduled, b.scheduled);
                    break;
                case 'priority':
                    comparison = this.comparePriorities(a.priority, b.priority);
                    break;
                case 'title':
                    comparison = a.title.localeCompare(b.title);
                    break;
            }

            // If primary criteria are equal, apply fallback sorting
            if (comparison === 0) {
                comparison = this.applyFallbackSorting(a, b, sortKey);
            }

            return direction === 'desc' ? -comparison : comparison;
        });
    }

    /**
     * Compare due dates with proper null handling using time-aware utilities
     * Supports both date-only (YYYY-MM-DD) and datetime (YYYY-MM-DDTHH:mm) formats
     */
    private compareDates(dateA?: string, dateB?: string): number {
        if (!dateA && !dateB) return 0;
        if (!dateA) return 1; // No due date sorts last
        if (!dateB) return -1;
        
        try {
            // Use time-aware comparison for precise sorting
            if (isBeforeDateTimeAware(dateA, dateB)) {
                return -1;
            } else if (isBeforeDateTimeAware(dateB, dateA)) {
                return 1;
            } else {
                return 0;
            }
        } catch (error) {
            console.error('Error comparing dates time-aware:', { dateA, dateB, error });
            // Fallback to string comparison
            return dateA.localeCompare(dateB);
        }
    }

    /**
     * Compare priorities using PriorityManager weights
     */
    private comparePriorities(priorityA: string, priorityB: string): number {
        const weightA = this.priorityManager.getPriorityWeight(priorityA);
        const weightB = this.priorityManager.getPriorityWeight(priorityB);
        
        // Higher weight = higher priority, so reverse for ascending order
        return weightB - weightA;
    }

    /**
     * Apply fallback sorting criteria when primary sort yields equal values
     * Order: scheduled date → due date → priority → title
     */
    private applyFallbackSorting(a: TaskInfo, b: TaskInfo, primarySortKey: TaskSortKey): number {
        // Define fallback order: scheduled → due → priority → title
        const fallbackOrder: TaskSortKey[] = ['scheduled', 'due', 'priority', 'title'];
        
        // Remove the primary sort key from fallbacks to avoid redundant comparison
        const fallbacks = fallbackOrder.filter(key => key !== primarySortKey);
        
        for (const fallbackKey of fallbacks) {
            let comparison = 0;
            
            switch (fallbackKey) {
                case 'scheduled':
                    comparison = this.compareDates(a.scheduled, b.scheduled);
                    break;
                case 'due':
                    comparison = this.compareDates(a.due, b.due);
                    break;
                case 'priority':
                    comparison = this.comparePriorities(a.priority, b.priority);
                    break;
                case 'title':
                    comparison = a.title.localeCompare(b.title);
                    break;
            }
            
            // Return first non-zero comparison
            if (comparison !== 0) {
                return comparison;
            }
        }
        
        // All criteria equal
        return 0;
    }

    /**
     * Group sorted tasks by specified criteria
     */
    private groupTasks(tasks: TaskInfo[], groupKey: TaskGroupKey, targetDate?: Date): Map<string, TaskInfo[]> {
        if (groupKey === 'none') {
            return new Map([['all', tasks]]);
        }

        const groups = new Map<string, TaskInfo[]>();

        for (const task of tasks) {
            // For projects, handle multiple groups per task
            if (groupKey === 'project') {
                const filteredProjects = filterEmptyProjects(task.projects || []);
                if (filteredProjects.length > 0) {
                    // Add task to each project group
                    for (const project of filteredProjects) {
                        if (!groups.has(project)) {
                            groups.set(project, []);
                        }
                        groups.get(project)!.push(task);
                    }
                } else {
                    // Task has no projects - add to "No Project" group
                    const noProjectGroup = 'No Project';
                    if (!groups.has(noProjectGroup)) {
                        groups.set(noProjectGroup, []);
                    }
                    groups.get(noProjectGroup)!.push(task);
                }
            } else {
                // For all other grouping types, use single group assignment
                let groupValue: string;

                switch (groupKey) {
                    case 'status':
                        groupValue = task.status || 'no-status';
                        break;
                    case 'priority':
                        groupValue = task.priority || 'unknown';
                        break;
                    case 'context':
                        // For multiple contexts, put task in first context or 'none'
                        groupValue = (task.contexts && task.contexts.length > 0) 
                            ? task.contexts[0] 
                            : 'none';
                        break;
                    case 'due':
                        groupValue = this.getDueDateGroup(task, targetDate);
                        break;
                    case 'scheduled':
                        groupValue = this.getScheduledDateGroup(task, targetDate);
                        break;
                    default:
                        groupValue = 'unknown';
                }

                if (!groups.has(groupValue)) {
                    groups.set(groupValue, []);
                }
                groups.get(groupValue)!.push(task);
            }
        }

        return this.sortGroups(groups, groupKey);
    }

    /**
     * Get due date group for task (Today, Tomorrow, This Week, etc.)
     * For recurring tasks, checks if the task is due on the target date
     */
    private getDueDateGroup(task: TaskInfo, targetDate?: Date): string {
        // Use target date if provided, otherwise use today
        const referenceDate = targetDate || new Date();
        referenceDate.setHours(0, 0, 0, 0);

        // For recurring tasks, check if due on the target date
        if (task.recurrence) {
            if (isDueByRRule(task, referenceDate)) {
                // If due on target date, determine which group based on target date vs today
                const referenceDateStr = format(referenceDate, 'yyyy-MM-dd');
                return this.getDateGroupFromDateString(referenceDateStr);
            } else {
                // Recurring task not due on target date
                // If it has an original due date, use that, otherwise no due date
                if (task.due) {
                    return this.getDueDateGroupFromDate(task.due);
                }
                return 'No due date';
            }
        }
        
        // Non-recurring task - use original logic
        if (!task.due) return 'No due date';
        return this.getDueDateGroupFromDate(task.due);
    }
    
    /**
     * Helper method to get date group from a date string (shared logic)
     * Uses time-aware overdue detection for precise categorization
     */
    private getDateGroupFromDateString(dateString: string): string {
        const todayStr = getTodayString();
        
        // Use time-aware overdue detection
        if (isOverdueTimeAware(dateString)) return 'Overdue';
        
        // Extract date part for day-level comparisons
        const datePart = getDatePart(dateString);
        if (isSameDateSafe(datePart, todayStr)) return 'Today';
        
        try {
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            const tomorrowStr = format(tomorrow, 'yyyy-MM-dd');
            if (isSameDateSafe(datePart, tomorrowStr)) return 'Tomorrow';
            
            const thisWeek = new Date();
            thisWeek.setDate(thisWeek.getDate() + 7);
            const thisWeekStr = format(thisWeek, 'yyyy-MM-dd');
            if (isBeforeDateSafe(datePart, thisWeekStr) || isSameDateSafe(datePart, thisWeekStr)) return 'This week';
            
            return 'Later';
        } catch (error) {
            console.error(`Error categorizing date ${dateString}:`, error);
            return 'Invalid Date';
        }
    }

    /**
     * Helper method to get due date group from a specific date string
     */
    private getDueDateGroupFromDate(dueDate: string): string {
        return this.getDateGroupFromDateString(dueDate);
    }

    private getScheduledDateGroup(task: TaskInfo, targetDate?: Date): string {
        if (!task.scheduled) return 'No scheduled date';
        return this.getScheduledDateGroupFromDate(task.scheduled);
    }
    
    /**
     * Helper method to get scheduled date group from a specific date string
     * Uses time-aware overdue detection for precise categorization
     */
    private getScheduledDateGroupFromDate(scheduledDate: string): string {
        const todayStr = getTodayString();
        
        // Use time-aware overdue detection for past scheduled
        if (isOverdueTimeAware(scheduledDate)) return 'Past scheduled';
        
        // Extract date part for day-level comparisons
        const datePart = getDatePart(scheduledDate);
        if (isSameDateSafe(datePart, todayStr)) return 'Today';
        
        try {
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            const tomorrowStr = format(tomorrow, 'yyyy-MM-dd');
            if (isSameDateSafe(datePart, tomorrowStr)) return 'Tomorrow';
            
            const thisWeek = new Date();
            thisWeek.setDate(thisWeek.getDate() + 7);
            const thisWeekStr = format(thisWeek, 'yyyy-MM-dd');
            if (isBeforeDateSafe(datePart, thisWeekStr) || isSameDateSafe(datePart, thisWeekStr)) return 'This week';
            
            return 'Later';
        } catch (error) {
            console.error(`Error categorizing scheduled date ${scheduledDate}:`, error);
            return 'Invalid Date';
        }
    }

    /**
     * Sort groups according to logical order
     */
    private sortGroups(groups: Map<string, TaskInfo[]>, groupKey: TaskGroupKey): Map<string, TaskInfo[]> {
        const sortedGroups = new Map<string, TaskInfo[]>();
        
        let sortedKeys: string[];
        
        switch (groupKey) {
            case 'priority':
                // Sort by priority weight (high to low)
                sortedKeys = Array.from(groups.keys()).sort((a, b) => {
                    const weightA = this.priorityManager.getPriorityWeight(a);
                    const weightB = this.priorityManager.getPriorityWeight(b);
                    return weightB - weightA;
                });
                break;
                
            case 'status':
                // Sort by status order
                sortedKeys = Array.from(groups.keys()).sort((a, b) => {
                    const orderA = this.statusManager.getStatusOrder(a);
                    const orderB = this.statusManager.getStatusOrder(b);
                    return orderA - orderB;
                });
                break;
                
            case 'due': {
                // Sort by logical due date order
                const dueDateOrder = ['Overdue', 'Today', 'Tomorrow', 'This week', 'Later', 'No due date'];
                sortedKeys = Array.from(groups.keys()).sort((a, b) => {
                    const indexA = dueDateOrder.indexOf(a);
                    const indexB = dueDateOrder.indexOf(b);
                    return indexA - indexB;
                });
                break;
            }
                
            case 'scheduled': {
                // Sort by logical scheduled date order
                const scheduledDateOrder = ['Past scheduled', 'Today', 'Tomorrow', 'This week', 'Later', 'No scheduled date'];
                sortedKeys = Array.from(groups.keys()).sort((a, b) => {
                    const indexA = scheduledDateOrder.indexOf(a);
                    const indexB = scheduledDateOrder.indexOf(b);
                    return indexA - indexB;
                });
                break;
            }
                
            case 'project':
                // Sort projects alphabetically with "No Project" at the end
                sortedKeys = Array.from(groups.keys()).sort((a, b) => {
                    if (a === 'No Project') return 1;
                    if (b === 'No Project') return -1;
                    return a.localeCompare(b);
                });
                break;
                
            default:
                // Alphabetical sort for contexts and others
                sortedKeys = Array.from(groups.keys()).sort();
        }

        // Rebuild map in sorted order
        for (const key of sortedKeys) {
            sortedGroups.set(key, groups.get(key)!);
        }

        return sortedGroups;
    }

    /**
     * Get available filter options for building FilterBar UI
     */
    async getFilterOptions(): Promise<{
        statuses: string[];
        priorities: string[];
        contexts: string[];
        projects: string[];
    }> {
        const allOptions = {
            statuses: this.cacheManager.getAllStatuses(),
            priorities: this.cacheManager.getAllPriorities(),
            contexts: this.cacheManager.getAllContexts(),
            projects: this.cacheManager.getAllProjects()
        };
        
        return allOptions;
    }

    /**
     * Create a default filter query with the new structure
     */
    createDefaultQuery(): FilterQuery {
        return {
            type: 'group',
            id: this.generateId(),
            conjunction: 'and',
            children: [],
            sortKey: 'due',
            sortDirection: 'asc',
            groupKey: 'none'
        };
    }

    /**
     * Generate a unique ID for filter nodes
     */
    private generateId(): string {
        return Math.random().toString(36).substr(2, 9);
    }


    /**
     * Add quick toggle conditions (Show Completed, Show Archived, Hide Recurring)
     * These are syntactic sugar that programmatically modify the root query
     */
    addQuickToggleCondition(query: FilterQuery, toggle: 'showCompleted' | 'showArchived' | 'showRecurrent', enabled: boolean): FilterQuery {
        const newQuery = JSON.parse(JSON.stringify(query)); // Deep clone

        // Remove existing condition for this toggle if it exists
        this.removeQuickToggleCondition(newQuery, toggle);

        // Add new condition if toggle is disabled (meaning we want to filter out)
        if (!enabled) {
            let condition: FilterCondition;
            
            switch (toggle) {
                case 'showCompleted':
                    condition = {
                        type: 'condition',
                        id: this.generateId(),
                        property: 'status.isCompleted',
                        operator: 'is-not-checked',
                        value: null
                    };
                    break;
                case 'showArchived':
                    condition = {
                        type: 'condition',
                        id: this.generateId(),
                        property: 'archived',
                        operator: 'is-not-checked',
                        value: null
                    };
                    break;
                case 'showRecurrent':
                    condition = {
                        type: 'condition',
                        id: this.generateId(),
                        property: 'recurrence',
                        operator: 'is-empty',
                        value: null
                    };
                    break;
            }
            
            newQuery.children.push(condition);
        }

        return newQuery;
    }

    /**
     * Remove quick toggle condition from query
     */
    private removeQuickToggleCondition(query: FilterQuery, toggle: 'showCompleted' | 'showArchived' | 'showRecurrent'): void {
        let propertyToRemove: string;
        
        switch (toggle) {
            case 'showCompleted':
                propertyToRemove = 'status.isCompleted';
                break;
            case 'showArchived':
                propertyToRemove = 'archived';
                break;
            case 'showRecurrent':
                propertyToRemove = 'recurrence';
                break;
        }

        query.children = query.children.filter(child => {
            if (child.type === 'condition') {
                return child.property !== propertyToRemove;
            }
            return true;
        });
    }

    /**
     * Validate and normalize a filter query
     */
    normalizeQuery(query: Partial<FilterQuery>): FilterQuery {
        const defaultQuery = this.createDefaultQuery();
        
        return {
            ...defaultQuery,
            ...query,
            type: 'group',
            id: query.id || defaultQuery.id,
            conjunction: query.conjunction || defaultQuery.conjunction,
            children: query.children || defaultQuery.children,
            sortKey: query.sortKey || defaultQuery.sortKey,
            sortDirection: query.sortDirection || defaultQuery.sortDirection,
            groupKey: query.groupKey || defaultQuery.groupKey
        };
    }

    /**
     * Subscribe to cache changes and emit refresh events
     */
    initialize(): void {
        this.cacheManager.on('file-updated', () => {
            this.emit('data-changed');
        });
        
        this.cacheManager.on('file-added', () => {
            this.emit('data-changed');
        });
        
        this.cacheManager.on('file-deleted', () => {
            this.emit('data-changed');
        });
    }

    /**
     * Clean up event subscriptions and clear any caches
     */
    cleanup(): void {
        // Remove all event listeners
        this.removeAllListeners();
    }

    // ============================================================================
    // AGENDA-SPECIFIC METHODS
    // ============================================================================

    /**
     * Generate date range for agenda views from array of dates
     */
    static createDateRangeFromDates(dates: Date[]): { start: string; end: string } {
        if (dates.length === 0) throw new Error('No dates provided');
        const startDate = dates[0];
        const endDate = dates[dates.length - 1];
        
        return {
            start: format(startDate, 'yyyy-MM-dd'),
            end: format(endDate, 'yyyy-MM-dd')
        };
    }

    /**
     * Check if overdue tasks should be included for a date range
     */
    static shouldIncludeOverdueForRange(dates: Date[], showOverdue: boolean): boolean {
        if (!showOverdue) return false;
        
        const today = new Date();
        const todayStr = format(today, 'yyyy-MM-dd');
        return dates.some(date => format(date, 'yyyy-MM-dd') === todayStr);
    }

    /**
     * Get tasks for a specific date within an agenda view
     * Handles recurring tasks, due dates, scheduled dates, and overdue logic
     */
    async getTasksForDate(
        date: Date, 
        baseQuery: FilterQuery,
        includeOverdue = false
    ): Promise<TaskInfo[]> {
        // Normalize to the date string first to avoid timezone boundary issues
        const dateStr = format(date, 'yyyy-MM-dd');
        const normalizedDate = startOfDayForDateString(dateStr);
        const isViewingToday = isTodayUtil(dateStr);
        
        
        // Get all tasks and filter using new system
        const allTaskPaths = this.cacheManager.getAllTaskPaths();
        const allTasks = await this.pathsToTaskInfos(Array.from(allTaskPaths));
        const filteredTasks = allTasks.filter(task => this.evaluateFilterNode(baseQuery, task));

        const tasksForDate = filteredTasks.filter(task => {
            // Handle recurring tasks
            if (task.recurrence) {
                return isDueByRRule(task, normalizedDate);
            }
            
            // Handle regular tasks with due dates for this specific date
            // Use robust date comparison to handle timezone edge cases
            if (task.due) {
                const taskDueDatePart = getDatePart(task.due);
                if (taskDueDatePart === dateStr) {
                    return true;
                }
            }
            
            // Handle regular tasks with scheduled dates for this specific date  
            // Use robust date comparison to handle timezone edge cases
            if (task.scheduled) {
                const taskScheduledDatePart = getDatePart(task.scheduled);
                if (taskScheduledDatePart === dateStr) {
                    return true;
                }
            }
            
            // If showing overdue tasks and this is today, include overdue tasks on today
            if (includeOverdue && isViewingToday) {
                // Check if due date is overdue (show on today)
                if (task.due && getDatePart(task.due) !== dateStr) {
                    if (isOverdueTimeAware(task.due)) {
                        return true;
                    }
                }
                
                // Check if scheduled date is overdue (show on today)
                if (task.scheduled && getDatePart(task.scheduled) !== dateStr) {
                    if (isOverdueTimeAware(task.scheduled)) {
                        return true;
                    }
                }
            }
            
            return false;
        });

        // Apply sorting to the filtered tasks for this date
        return this.sortTasks(tasksForDate, baseQuery.sortKey || 'due', baseQuery.sortDirection || 'asc');
    }

    /**
     * Get agenda data grouped by dates for agenda views
     * Simplified for new filter system
     */
    async getAgendaData(
        dates: Date[], 
        baseQuery: FilterQuery,
        showOverdueOnToday = false
    ): Promise<Array<{date: Date; tasks: TaskInfo[]}>> {
        const agendaData: Array<{date: Date; tasks: TaskInfo[]}> = [];

        // Get tasks for each date
        for (const date of dates) {
            const tasksForDate = await this.getTasksForDate(
                date, 
                baseQuery, 
                showOverdueOnToday && isToday(date)
            );
            
            agendaData.push({
                date: new Date(date),
                tasks: tasksForDate
            });
        }

        return agendaData;
    }

    /**
     * Get flat agenda data (all tasks in one array) with date information attached
     * Useful for flat agenda view rendering
     */
    async getFlatAgendaData(
        dates: Date[], 
        baseQuery: FilterQuery,
        showOverdueOnToday = false
    ): Promise<Array<TaskInfo & {agendaDate: Date}>> {
        const groupedData = await this.getAgendaData(dates, baseQuery, showOverdueOnToday);
        
        const flatData: Array<TaskInfo & {agendaDate: Date}> = [];
        
        for (const dayData of groupedData) {
            for (const task of dayData.tasks) {
                flatData.push({
                    ...task,
                    agendaDate: dayData.date
                });
            }
        }

        return flatData;
    }

    /**
     * Extract project names from a task project value, handling [[link]] format
     * This mirrors the logic from MinimalNativeCache.extractProjectNamesFromValue
     */
    private extractProjectNamesFromTaskValue(projectValue: string, sourcePath: string): string[] {
        if (!projectValue || projectValue.trim() === '' || projectValue === '""') {
            return [];
        }

        // Remove quotes if the value is wrapped in them
        const cleanValue = projectValue.replace(/^"(.*)"$/, '$1');
        
        // Check if it's a wikilink format
        if (cleanValue.startsWith('[[') && cleanValue.endsWith(']]')) {
            const linkContent = cleanValue.slice(2, -2);
            const parsed = parseLinktext(linkContent);
            
            // Try to resolve the link using Obsidian's API through cache manager
            const resolvedFile = this.cacheManager.getApp().metadataCache.getFirstLinkpathDest(parsed.path, sourcePath);
            if (resolvedFile) {
                // Return the basename of the resolved file
                return [resolvedFile.basename];
            } else {
                // If file doesn't exist, use the display text or path
                const displayName = parsed.subpath || (parsed.path.includes('/') ? parsed.path.split('/').pop() : parsed.path);
                return displayName ? [displayName] : [];
            }
        } else {
            // Plain text project (backward compatibility)
            return [cleanValue];
        }
    }
}
