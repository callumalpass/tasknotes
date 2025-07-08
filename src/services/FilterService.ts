import { FilterQuery, TaskInfo, TaskSortKey, TaskGroupKey, SortDirection } from '../types';
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
     * Uses performance-optimized strategy starting with smallest dataset
     */
    async getGroupedTasks(query: FilterQuery, targetDate?: Date): Promise<Map<string, TaskInfo[]>> {
        // Step 1: Get initial task set using best available index
        let initialTaskPaths = await this.getInitialTaskSet(query);
        
        // Step 2: Convert paths to TaskInfo objects with filtering
        const filteredTasks = await this.filterTasksByQuery(initialTaskPaths, query);
        
        // Step 3: Sort the filtered results
        const sortedTasks = this.sortTasks(filteredTasks, query.sortKey, query.sortDirection);
        
        // Step 4: Group the sorted results
        return this.groupTasks(sortedTasks, query.groupKey, targetDate);
    }

    /**
     * Get the smallest possible initial dataset using CacheManager indexes
     * Priority order: status > priority > date > all tasks
     */
    private async getInitialTaskSet(query: FilterQuery): Promise<Set<string>> {
        // Strategy 1: Use specific status index
        if (query.statuses && query.statuses.length === 1) {
            const statusPathsArray = this.cacheManager.getTaskPathsByStatus(query.statuses[0]);
            const statusPaths = new Set(statusPathsArray);
            if (statusPaths.size > 0) {
                return statusPaths;
            }
        } else if (query.statuses && query.statuses.length > 1) {
            // Multiple statuses: combine their index sets
            const combinedPaths = new Set<string>();
            for (const status of query.statuses) {
                const statusPathsArray = this.cacheManager.getTaskPathsByStatus(status);
                statusPathsArray.forEach(path => combinedPaths.add(path));
            }
            if (combinedPaths.size > 0) {
                return combinedPaths;
            }
        }

        // Strategy 2: Use priority index if specific priorities requested
        if (query.priorities && query.priorities.length === 1) {
            const priorityPathsArray = this.cacheManager.getTaskPathsByPriority(query.priorities[0]);
            const priorityPaths = new Set(priorityPathsArray);
            if (priorityPaths.size > 0) {
                return priorityPaths;
            }
        }

        // Strategy 3: Use date range if specified (with optional overdue tasks)
        if (query.dateRange) {
            const dateRangePaths = await this.getTaskPathsInDateRange(query.dateRange.start, query.dateRange.end);
            
            // If includeOverdue is true, combine with overdue tasks
            if (query.includeOverdue) {
                const overduePaths = this.getOverdueTaskPaths();
                return this.combineTaskPathSets([dateRangePaths, overduePaths]);
            }
            
            return dateRangePaths;
        }

        // Strategy 4: Fallback to all tasks
        return this.cacheManager.getAllTaskPaths();
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
     * Filter task paths to TaskInfo objects based on query criteria
     */
    private async filterTasksByQuery(taskPaths: Set<string>, query: FilterQuery): Promise<TaskInfo[]> {
        const filteredTasks: TaskInfo[] = [];
        
        // Process paths in batches for better performance
        const batchSize = 50;
        const pathArray = Array.from(taskPaths);

        for (let i = 0; i < pathArray.length; i += batchSize) {
            const batch = pathArray.slice(i, i + batchSize);
            const batchTasks = await Promise.all(
                batch.map(path => this.cacheManager.getCachedTaskInfo(path))
            );

            for (const task of batchTasks) {
                if (task && this.matchesQuery(task, query)) {
                    filteredTasks.push(task);
                }
            }
        }

        return filteredTasks;
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
     * Check if a task matches the filter query
     */
    private matchesQuery(task: TaskInfo, query: FilterQuery): boolean {
        // Search query filter
        if (query.searchQuery) {
            const searchTerm = query.searchQuery.toLowerCase();
            const titleMatch = (task.title || '').toLowerCase().includes(searchTerm);
            const contextMatch = task.contexts?.some(context => 
                context && typeof context === 'string' && context.toLowerCase().includes(searchTerm)
            ) || false;
            const filteredProjectsForSearch = filterEmptyProjects(task.projects || []);
            const projectMatch = filteredProjectsForSearch.some(project => 
                project.toLowerCase().includes(searchTerm)
            );
            
            if (!titleMatch && !contextMatch && !projectMatch) {
                return false;
            }
        }

        // Status filter (if not already used for initial set)
        if (query.statuses && query.statuses.length > 0) {
            // Check if task status is in the selected statuses
            if (!query.statuses.includes(task.status)) {
                return false;
            }
        }

        // Priority filter (if not already used for initial set)
        if (query.priorities && query.priorities.length > 0) {
            if (!query.priorities.includes(task.priority)) {
                return false;
            }
        }

        // Context filter
        if (query.contexts && query.contexts.length > 0) {
            if (!task.contexts || !query.contexts.some(context => 
                task.contexts!.includes(context)
            )) {
                return false;
            }
        }

        // Project filter
        if (query.projects && query.projects.length > 0) {
            const filteredProjects = filterEmptyProjects(task.projects || []);
            if (filteredProjects.length === 0) {
                return false;
            }
            
            // Extract project names from task project values (handling [[links]])
            const taskProjectNames = filteredProjects.flatMap(projectValue => 
                this.extractProjectNamesFromTaskValue(projectValue, task.path)
            );
            
            // Check if any selected project matches any extracted project name
            const hasMatchingProject = query.projects.some(selectedProject => 
                taskProjectNames.includes(selectedProject)
            );
            
            if (!hasMatchingProject) {
                return false;
            }
        }

        // Archived filter
        if (!query.showArchived && task.archived) {
            return false;
        }

        // Date range filter (if not already used for initial set)
        if (query.dateRange) {
            // For recurring tasks without due dates, check if they appear on any date in range
            if (task.recurrence && !task.due) {
                const startDate = new Date(query.dateRange.start);
                const endDate = new Date(query.dateRange.end);
                
                // Check each date in range to see if recurring task should appear
                let appearsInRange = false;
                for (let date = new Date(startDate); date <= endDate; date.setDate(date.getDate() + 1)) {
                    if (isDueByRRule(task, date)) {
                        appearsInRange = true;
                        break;
                    }
                }
                
                if (!appearsInRange) {
                    return false;
                }
            }
            // For tasks with due dates or scheduled dates, check if either falls within range
            else if (task.due || task.scheduled) {
                let inRange = false;
                
                // Check due date
                if (task.due) {
                    if (query.includeOverdue && isOverdueTimeAware(task.due)) {
                        // This is an overdue task and we want to include overdue tasks
                        inRange = true;
                    } else if (this.isDateInRange(task.due, query.dateRange.start, query.dateRange.end)) {
                        inRange = true;
                    }
                }
                
                // Check scheduled date if due date doesn't qualify
                if (!inRange && task.scheduled) {
                    if (query.includeOverdue && isOverdueTimeAware(task.scheduled)) {
                        // This is an overdue scheduled task and we want to include overdue tasks
                        inRange = true;
                    } else if (this.isDateInRange(task.scheduled, query.dateRange.start, query.dateRange.end)) {
                        inRange = true;
                    }
                }
                
                if (!inRange) {
                    return false;
                }
            }
        }

        // Show options filters
        
        // Show recurrent tasks filter
        if (query.showRecurrent === false && task.recurrence) {
            return false;
        }
        
        // Show completed tasks filter
        if (query.showCompleted === false) {
            // Check if task is completed using StatusManager (user-defined completion statuses)
            if (this.statusManager.isCompletedStatus(task.status) || task.completedDate) {
                return false;
            }
        }

        return true;
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
        const options = {
            statuses: this.cacheManager.getAllStatuses(),
            priorities: this.cacheManager.getAllPriorities(),
            contexts: this.cacheManager.getAllContexts(),
            projects: this.cacheManager.getAllProjects()
        };
        
        // Debug: Log filter options
        console.debug('FilterService: getFilterOptions returning:', options);
        
        return options;
    }

    /**
     * Create a default filter query
     */
    createDefaultQuery(): FilterQuery {
        return {
            searchQuery: undefined,
            statuses: undefined,
            contexts: undefined,
            projects: undefined,
            priorities: undefined,
            dateRange: undefined,
            showArchived: false,
            sortKey: 'due',
            sortDirection: 'asc',
            groupKey: 'none'
        };
    }

    /**
     * Validate and normalize a filter query
     */
    normalizeQuery(query: Partial<FilterQuery>): FilterQuery {
        const defaultQuery = this.createDefaultQuery();
        
        return {
            searchQuery: query.searchQuery || defaultQuery.searchQuery,
            statuses: query.statuses || defaultQuery.statuses,
            contexts: query.contexts || defaultQuery.contexts,
            projects: query.projects || defaultQuery.projects,
            priorities: query.priorities || defaultQuery.priorities,
            dateRange: query.dateRange || defaultQuery.dateRange,
            showArchived: query.showArchived ?? defaultQuery.showArchived,
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
        const dateStr = format(date, 'yyyy-MM-dd');
        const isViewingToday = isTodayUtil(dateStr);
        
        // Get tasks using existing query logic but apply date-specific filtering
        const allTasks = await this.filterTasksByQuery(
            await this.getInitialTaskSet(baseQuery), 
            baseQuery
        );

        const tasksForDate = allTasks.filter(task => {
            // Handle recurring tasks
            if (task.recurrence) {
                return isDueByRRule(task, date);
            }
            
            // Handle regular tasks with due dates for this specific date
            // Use date part comparison to support both date-only and datetime formats
            if (task.due && getDatePart(task.due) === dateStr) {
                return true;
            }
            
            // Handle regular tasks with scheduled dates for this specific date  
            // Use date part comparison to support both date-only and datetime formats
            if (task.scheduled && getDatePart(task.scheduled) === dateStr) {
                return true;
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
        return this.sortTasks(tasksForDate, baseQuery.sortKey, baseQuery.sortDirection);
    }

    /**
     * Get agenda data grouped by dates for agenda views
     * Centralizes all the complex agenda filtering logic
     */
    async getAgendaData(
        dates: Date[], 
        baseQuery: Omit<FilterQuery, 'dateRange' | 'includeOverdue'>,
        showOverdueOnToday = false
    ): Promise<Array<{date: Date; tasks: TaskInfo[]}>> {
        // Build the complete query with date range
        const dateRange = FilterService.createDateRangeFromDates(dates);
        
        // Always include overdue tasks in the initial set if today is in the date range,
        // but control their display per-date in getTasksForDate
        const includeOverdue = FilterService.shouldIncludeOverdueForRange(dates, showOverdueOnToday);
        
        const completeQuery: FilterQuery = {
            ...baseQuery,
            dateRange,
            includeOverdue
        };

        const agendaData: Array<{date: Date; tasks: TaskInfo[]}> = [];

        // Get tasks for each date
        for (const date of dates) {
            const tasksForDate = await this.getTasksForDate(
                date, 
                completeQuery, 
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
        baseQuery: Omit<FilterQuery, 'dateRange' | 'includeOverdue'>,
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
