import { TFile, setIcon, Notice, Modal, App, setTooltip } from 'obsidian';
import { TaskInfo } from '../types';
import TaskNotesPlugin from '../main';
import { TaskContextMenu } from '../components/TaskContextMenu';
import { calculateTotalTimeSpent, getEffectiveTaskStatus, getRecurrenceDisplayText, filterEmptyProjects } from '../utils/helpers';
import { 
    formatDateTimeForDisplay,
    isTodayTimeAware,
    isOverdueTimeAware,
    getDatePart,
    getTimePart
} from '../utils/dateUtils';
import { DateContextMenu } from '../components/DateContextMenu';
import { PriorityContextMenu } from '../components/PriorityContextMenu';
import { RecurrenceContextMenu } from '../components/RecurrenceContextMenu';
import { createTaskClickHandler, createTaskHoverHandler } from '../utils/clickHandlers';
import { ReminderModal } from '../modals/ReminderModal';

export interface TaskCardOptions {
    showDueDate: boolean;
    showCheckbox: boolean;
    showArchiveButton: boolean;
    showTimeTracking: boolean;
    showRecurringControls: boolean;
    groupByDate: boolean;
    targetDate?: Date;
}

export const DEFAULT_TASK_CARD_OPTIONS: TaskCardOptions = {
    showDueDate: true,
    showCheckbox: false,
    showArchiveButton: false,
    showTimeTracking: false,
    showRecurringControls: true,
    groupByDate: false
};

/**
 * Helper function to attach date context menu click handlers
 */
function attachDateClickHandler(
    span: HTMLElement, 
    task: TaskInfo, 
    plugin: TaskNotesPlugin, 
    dateType: 'due' | 'scheduled'
): void {
    span.addEventListener('click', (e) => {
        e.stopPropagation(); // Don't trigger card click
        const currentValue = dateType === 'due' ? task.due : task.scheduled;
        const menu = new DateContextMenu({
            currentValue: getDatePart(currentValue || ''),
            currentTime: getTimePart(currentValue || ''),
            onSelect: async (dateValue, timeValue) => {
                try {
                    let finalValue: string | undefined;
                    if (!dateValue) {
                        finalValue = undefined;
                    } else if (timeValue) {
                        finalValue = `${dateValue}T${timeValue}`;
                    } else {
                        finalValue = dateValue;
                    }
                    await plugin.updateTaskProperty(task, dateType, finalValue);
                } catch (error) {
                    console.error(`Error updating ${dateType} date:`, error);
                    new Notice(`Failed to update ${dateType} date`);
                }
            }
        });
        menu.show(e as MouseEvent);
    });
}

/**
 * Get default visible properties when no custom configuration is provided
 */
function getDefaultVisibleProperties(): string[] {
    return [
        'due',         // Due date
        'scheduled',   // Scheduled date
        'projects',    // Projects
        'contexts',    // Contexts
        'tags'         // Tags
    ];
}

/**
 * Property value extractors for better type safety and error handling
 */
const PROPERTY_EXTRACTORS: Record<string, (task: TaskInfo) => any> = {
    'due': (task) => task.due,
    'scheduled': (task) => task.scheduled,
    'projects': (task) => task.projects,
    'contexts': (task) => task.contexts,
    'tags': (task) => task.tags,
    'timeEstimate': (task) => task.timeEstimate,
    'totalTrackedTime': (task) => task.totalTrackedTime,
    'recurrence': (task) => task.recurrence,
    'completedDate': (task) => task.completedDate,
    'file.ctime': (task) => task.dateCreated,
    'file.mtime': (task) => task.dateModified
};

/**
 * Get property value from a task with improved error handling and type safety
 */
function getPropertyValue(task: TaskInfo, propertyId: string, plugin: TaskNotesPlugin): unknown {
    try {
        // Use extractors for standard properties
        if (propertyId in PROPERTY_EXTRACTORS) {
            return PROPERTY_EXTRACTORS[propertyId](task);
        }
        
        // Handle user properties
        if (propertyId.startsWith('user:')) {
            return getUserPropertyValue(task, propertyId, plugin);
        }
        
        // Check custom properties from Bases or other sources
        if (task.customProperties && propertyId in task.customProperties) {
            return task.customProperties[propertyId];
        }
        
        // Handle Bases formula properties
        if (propertyId.startsWith('formula.') && task.basesData) {
            try {
                const formulaName = propertyId.substring(8); // Remove 'formula.' prefix
                const basesData = task.basesData;
                
                // Safe debug logging for TESTST formula
                if (formulaName === 'TESTST' && !(window as any)._basesDataLogged) {
                    (window as any)._basesDataLogged = true;
                    const hasFormulaResults = !!basesData?.formulaResults;
                    const hasCachedOutputs = !!basesData?.formulaResults?.cachedFormulaOutputs;
                    const hasTestst = !!basesData?.formulaResults?.cachedFormulaOutputs?.TESTST;
                    console.debug(`[TaskNotes] Formula debug - hasFormulaResults: ${hasFormulaResults}, hasCachedOutputs: ${hasCachedOutputs}, hasTestst: ${hasTestst}`);
                    
                    // Show what formulas ARE available in cache
                    if (hasCachedOutputs) {
                        const availableCachedFormulas = Object.keys(basesData.formulaResults.cachedFormulaOutputs);
                        console.debug('[TaskNotes] Available cached formulas:', availableCachedFormulas.length ? availableCachedFormulas : 'NONE');
                        
                        // Show values of available formulas
                        availableCachedFormulas.forEach(name => {
                            const value = basesData.formulaResults.cachedFormulaOutputs[name];
                            console.debug(`[TaskNotes] Cached ${name}:`, JSON.stringify(value));
                        });
                    }
                    
                    // Also check what formulas are DEFINED (even if not cached for this item)
                    if (basesData.formulaResults?.formulas) {
                        const definedFormulas = Object.keys(basesData.formulaResults.formulas);
                        console.debug('[TaskNotes] Defined formulas:', definedFormulas.length ? definedFormulas : 'NONE');
                    }
                    
                    if (hasTestst) {
                        const teststValue = basesData.formulaResults.cachedFormulaOutputs.TESTST;
                        console.debug('[TaskNotes] TESTST cached value:', JSON.stringify(teststValue));
                    }
                }
                
                // Access the formula computation system
                const formulaResults = basesData?.formulaResults;
                if (formulaResults?.cachedFormulaOutputs && formulaResults.cachedFormulaOutputs[formulaName] !== undefined) {
                    const cached = formulaResults.cachedFormulaOutputs[formulaName];
                    // Bases stores results as {icon: "...", data: actualValue}
                    if (cached && typeof cached === 'object' && 'data' in cached) {
                        return cached.data;
                    }
                    // Fallback: return the cached value directly
                    return cached;
                }
                
                return '[Formula]'; // Fallback if computation fails
            } catch (error) {
                console.debug(`[TaskNotes] Error computing formula ${propertyId}:`, error);
                return '[Formula Error]';
            }
        }
        
        // Fallback: try to get arbitrary property from frontmatter
        if (task.path) {
            const value = getFrontmatterValue(task.path, propertyId, plugin);
            if (value !== undefined) {
                return value;
            }
        }
        
        return null;
    } catch (error) {
        console.warn(`TaskCard: Error getting property ${propertyId}:`, error);
        return null;
    }
}

/**
 * Extract user property value with improved error handling and type safety
 */
function getUserPropertyValue(task: TaskInfo, propertyId: string, plugin: TaskNotesPlugin): unknown {
    const fieldId = propertyId.slice(5);
    const userField = plugin.settings.userFields?.find(f => f.id === fieldId);
    
    if (!userField?.key) {
        return null;
    }
    
    // Try task object first (backward compatibility)
    let value = (task as unknown as Record<string, unknown>)[userField.key];
    
    // Fall back to frontmatter if needed
    if (value === undefined) {
        value = getFrontmatterValue(task.path, userField.key, plugin);
    }
    
    return value;
}

/**
 * Safely extract frontmatter value with proper typing
 */
function getFrontmatterValue(taskPath: string, key: string, plugin: TaskNotesPlugin): unknown {
    try {
        const fileMetadata = plugin.app.metadataCache.getCache(taskPath);
        if (!fileMetadata?.frontmatter) {
            return undefined;
        }
        
        const frontmatter = fileMetadata.frontmatter as Record<string, unknown>;
        return frontmatter[key];
    } catch (error) {
        console.warn(`TaskCard: Error accessing frontmatter for ${taskPath}:`, error);
        return undefined;
    }
}

/**
 * Property renderer function type for better type safety
 */
type PropertyRenderer = (element: HTMLElement, value: unknown, task: TaskInfo, plugin: TaskNotesPlugin) => void;

/**
 * Property renderers for cleaner separation of concerns
 */
const PROPERTY_RENDERERS: Record<string, PropertyRenderer> = {
    'due': (element, value, task, plugin) => {
        if (typeof value === 'string') {
            renderDueDateProperty(element, value, task, plugin);
        }
    },
    'scheduled': (element, value, task, plugin) => {
        if (typeof value === 'string') {
            renderScheduledDateProperty(element, value, task, plugin);
        }
    },
    'projects': (element, value, _, plugin) => {
        if (Array.isArray(value)) {
            renderProjectLinks(element, value as string[], plugin);
        }
    },
    'contexts': (element, value) => {
        if (Array.isArray(value)) {
            const validContexts = flattenAndFilter(value);
            element.textContent = `@${validContexts.join(', @')}`;
        }
    },
    'tags': (element, value) => {
        if (Array.isArray(value)) {
            const validTags = flattenAndFilter(value);
            element.textContent = `#${validTags.join(' #')}`;
        }
    },
    'timeEstimate': (element, value, _, plugin) => {
        if (typeof value === 'number') {
            element.textContent = `${plugin.formatTime(value)} estimated`;
        }
    },
    'totalTrackedTime': (element, value, _, plugin) => {
        if (typeof value === 'number') {
            element.textContent = `${plugin.formatTime(value)} tracked`;
        }
    },
    'recurrence': (element, value) => {
        if (typeof value === 'string') {
            element.textContent = `Recurring: ${getRecurrenceDisplayText(value)}`;
        }
    },
    'completedDate': (element, value) => {
        if (typeof value === 'string') {
            element.textContent = `Completed: ${formatDateTimeForDisplay(value, {
                dateFormat: 'MMM d', timeFormat: 'h:mm a', showTime: false
            })}`;
        }
    },
    'file.ctime': (element, value) => {
        if (typeof value === 'string') {
            element.textContent = `Created: ${formatDateTimeForDisplay(value, {
                dateFormat: 'MMM d', timeFormat: 'h:mm a', showTime: false
            })}`;
        }
    },
    'file.mtime': (element, value) => {
        if (typeof value === 'string') {
            element.textContent = `Modified: ${formatDateTimeForDisplay(value, {
                dateFormat: 'MMM d', timeFormat: 'h:mm a', showTime: false
            })}`;
        }
    }
};

/**
 * Render a single property as a metadata element with improved organization
 */
function renderPropertyMetadata(
    container: HTMLElement,
    propertyId: string,
    task: TaskInfo,
    plugin: TaskNotesPlugin
): HTMLElement | null {
    const value = getPropertyValue(task, propertyId, plugin);
    
    if (!hasValidValue(value)) {
        return null;
    }

    const element = container.createEl('span', {
        cls: `task-card__metadata-property task-card__metadata-property--${propertyId.replace(':', '-')}`
    });

    try {
        if (propertyId in PROPERTY_RENDERERS) {
            PROPERTY_RENDERERS[propertyId](element, value, task, plugin);
        } else if (propertyId.startsWith('user:')) {
            renderUserProperty(element, propertyId, value, plugin);
        } else {
            // Fallback: render arbitrary property with generic format
            renderGenericProperty(element, propertyId, value);
        }
        return element;
    } catch (error) {
        console.warn(`TaskCard: Error rendering property ${propertyId}:`, error);
        element.textContent = `${propertyId}: (error)`;
        return element;
    }
}

/**
 * Check if a value is valid for display
 */
function hasValidValue(value: any): boolean {
    return value !== null && 
           value !== undefined && 
           !(Array.isArray(value) && value.length === 0) &&
           !(typeof value === 'string' && value.trim() === '');
}

/**
 * Flatten and filter array values
 */
function flattenAndFilter(value: any[]): string[] {
    return value
        .flat(2)
        .filter(item => item !== null && item !== undefined && 
                typeof item === 'string' && item.trim() !== '');
}

/**
 * Render user-defined property with type safety
 */
function renderUserProperty(element: HTMLElement, propertyId: string, value: unknown, plugin: TaskNotesPlugin): void {
    const fieldId = propertyId.slice(5);
    const userField = plugin.settings.userFields?.find(f => f.id === fieldId);
    
    if (!userField) {
        element.textContent = `${fieldId}: (not found)`;
        return;
    }
    
    const displayValue = formatUserPropertyValue(value, userField);
    const fieldName = userField.displayName || fieldId;
    
    element.textContent = displayValue.trim() !== '' 
        ? `${fieldName}: ${displayValue}`
        : `${fieldName}: (empty)`;
}

/**
 * User field type definition for better type safety
 */
interface UserField {
    id: string;
    key: string;
    type: 'text' | 'number' | 'date' | 'boolean' | 'list';
    displayName?: string;
}

/**
 * Render generic property with smart formatting
 */
function renderGenericProperty(element: HTMLElement, propertyId: string, value: unknown): void {
    // Handle formula properties - show just the formula name, not "formula.TESTST"
    let displayName: string;
    if (propertyId.startsWith('formula.')) {
        displayName = propertyId.substring(8); // Remove "formula." prefix
    } else {
        displayName = propertyId.charAt(0).toUpperCase() + propertyId.slice(1);
    }
    
    let displayValue: string;
    
    if (Array.isArray(value)) {
        // Handle arrays by joining with commas
        const filtered = value.filter(v => v !== null && v !== undefined && v !== '');
        displayValue = filtered.join(', ');
    } else if (typeof value === 'object' && value !== null) {
        // Handle Date objects specially
        if (value instanceof Date) {
            displayValue = formatDateTimeForDisplay(value.toISOString(), {
                dateFormat: 'MMM d, yyyy',
                timeFormat: '',
                showTime: false
            });
        }
        // Handle objects with meaningful toString methods or simple key-value pairs
        else if (typeof value.toString === 'function' && value.toString() !== '[object Object]') {
            displayValue = value.toString();
        }
        // For simple objects with a few key-value pairs, show them nicely
        else {
            const entries = Object.entries(value as Record<string, any>);
            if (entries.length <= 3) {
                displayValue = entries
                    .map(([k, v]) => `${k}: ${v}`)
                    .join(', ');
            } else {
                // Fallback to JSON for complex objects
                displayValue = JSON.stringify(value);
            }
        }
    } else if (typeof value === 'boolean') {
        // Handle booleans with checkmark/x symbols for better visual
        displayValue = value ? '✓' : '✗';
    } else if (typeof value === 'number') {
        // Format numbers with appropriate precision
        displayValue = Number.isInteger(value) ? String(value) : value.toFixed(2);
    } else {
        // Handle strings and other primitive types
        displayValue = String(value);
    }
    
    // Truncate very long values to keep card readable
    if (displayValue.length > 100) {
        displayValue = displayValue.substring(0, 97) + '...';
    }
    
    element.textContent = `${displayName}: ${displayValue}`;
}

/**
 * Format user property value based on field type with improved type safety
 */
function formatUserPropertyValue(value: unknown, userField: UserField): string {
    if (value === null || value === undefined) return '';
    
    try {
        switch (userField.type) {
            case 'text':
            case 'number':
                return String(value);
            case 'date':
                return formatDateTimeForDisplay(String(value), {
                    dateFormat: 'MMM d, yyyy',
                    timeFormat: '',
                    showTime: false
                });
            case 'boolean':
                return value ? '✓' : '✗';
            case 'list':
                if (Array.isArray(value)) {
                    return (value as unknown[]).flat(2).join(', ');
                }
                return String(value);
            default:
                return String(value);
        }
    } catch (error) {
        console.warn('TaskCard: Error formatting user property value:', error);
        return String(value);
    }
}

/**
 * Render due date property with click handler
 */
function renderDueDateProperty(element: HTMLElement, due: string, task: TaskInfo, plugin: TaskNotesPlugin): void {
    const isDueToday = isTodayTimeAware(due);
    const isDueOverdue = isOverdueTimeAware(due);
    
    let dueDateText = '';
    if (isDueToday) {
        const timeDisplay = formatDateTimeForDisplay(due, {
            dateFormat: '',
            timeFormat: 'h:mm a',
            showTime: true
        });
        dueDateText = timeDisplay.trim() === '' ? 'Due: Today' : `Due: Today at ${timeDisplay}`;
    } else if (isDueOverdue) {
        const display = formatDateTimeForDisplay(due, {
            dateFormat: 'MMM d',
            timeFormat: 'h:mm a',
            showTime: true
        });
        dueDateText = `Due: ${display} (overdue)`;
    } else {
        const display = formatDateTimeForDisplay(due, {
            dateFormat: 'MMM d',
            timeFormat: 'h:mm a',
            showTime: true
        });
        dueDateText = `Due: ${display}`;
    }

    element.textContent = dueDateText;
    element.classList.add('task-card__metadata-date', 'task-card__metadata-date--due');
    attachDateClickHandler(element, task, plugin, 'due');
}

/**
 * Render scheduled date property with click handler
 */
function renderScheduledDateProperty(element: HTMLElement, scheduled: string, task: TaskInfo, plugin: TaskNotesPlugin): void {
    const isScheduledToday = isTodayTimeAware(scheduled);
    const isScheduledPast = isOverdueTimeAware(scheduled);
    
    let scheduledDateText = '';
    if (isScheduledToday) {
        const timeDisplay = formatDateTimeForDisplay(scheduled, {
            dateFormat: '',
            timeFormat: 'h:mm a',
            showTime: true
        });
        scheduledDateText = timeDisplay.trim() === '' ? 'Scheduled: Today' : `Scheduled: Today at ${timeDisplay}`;
    } else if (isScheduledPast) {
        const display = formatDateTimeForDisplay(scheduled, {
            dateFormat: 'MMM d',
            timeFormat: 'h:mm a',
            showTime: true
        });
        scheduledDateText = `Scheduled: ${display} (past)`;
    } else {
        const display = formatDateTimeForDisplay(scheduled, {
            dateFormat: 'MMM d',
            timeFormat: 'h:mm a',
            showTime: true
        });
        scheduledDateText = `Scheduled: ${display}`;
    }

    element.textContent = scheduledDateText;
    element.classList.add('task-card__metadata-date', 'task-card__metadata-date--scheduled');
    attachDateClickHandler(element, task, plugin, 'scheduled');
}

/**
 * Add separators between metadata elements
 */
function addMetadataSeparators(metadataLine: HTMLElement, metadataElements: HTMLElement[]): void {
    if (metadataElements.length > 0) {
        // Insert separators between elements
        for (let i = 1; i < metadataElements.length; i++) {
            const separator = metadataLine.createEl('span', { 
                cls: 'task-card__metadata-separator',
                text: ' • ' 
            });
            // Insert separator before each element (except first)
            metadataElements[i].insertAdjacentElement('beforebegin', separator);
        }
        metadataLine.style.display = '';
    } else {
        metadataLine.style.display = 'none';
    }
}

/**
 * Create a minimalist, unified task card element
 */
export function createTaskCard(task: TaskInfo, plugin: TaskNotesPlugin, visibleProperties?: string[], options: Partial<TaskCardOptions> = {}): HTMLElement {
    const opts = { ...DEFAULT_TASK_CARD_OPTIONS, ...options };
    const targetDate = opts.targetDate || plugin.selectedDate || new Date();
    
    // Determine effective status for recurring tasks
    const effectiveStatus = task.recurrence 
        ? getEffectiveTaskStatus(task, targetDate)
        : task.status;
    
    // Main container with BEM class structure
    const card = document.createElement('div');
    
    // Store task path for circular reference detection
    (card as any)._taskPath = task.path;
    
    const isActivelyTracked = plugin.getActiveTimeSession(task) !== null;
    const isCompleted = plugin.statusManager.isCompletedStatus(effectiveStatus);
    const isRecurring = !!task.recurrence;
    
    // Build BEM class names
    const cardClasses = ['task-card'];
    
    // Add modifiers
    if (isCompleted) cardClasses.push('task-card--completed');
    if (task.archived) cardClasses.push('task-card--archived');
    if (isActivelyTracked) cardClasses.push('task-card--actively-tracked');
    if (isRecurring) cardClasses.push('task-card--recurring');
    if (opts.showCheckbox) cardClasses.push('task-card--checkbox-enabled');
    
    // Add priority modifier
    if (task.priority) {
        cardClasses.push(`task-card--priority-${task.priority}`);
    }
    
    // Add status modifier
    if (effectiveStatus) {
        cardClasses.push(`task-card--status-${effectiveStatus}`);
    }

    // Chevron position preference
    if (plugin.settings?.subtaskChevronPosition === 'left') {
        cardClasses.push('task-card--chevron-left');
    }

    // Add project modifier (for issue #355)
    const hasProjects = filterEmptyProjects(task.projects || []).length > 0;
    if (hasProjects) {
        cardClasses.push('task-card--has-projects');
    }
    
    card.className = cardClasses.join(' ');
    card.dataset.taskPath = task.path;
    card.dataset.key = task.path; // For DOMReconciler compatibility
    card.dataset.status = effectiveStatus;
    
    // Create main row container for horizontal layout
    const mainRow = card.createEl('div', { cls: 'task-card__main-row' });
    
    // Apply priority and status colors as CSS custom properties
    const priorityConfig = plugin.priorityManager.getPriorityConfig(task.priority);
    if (priorityConfig) {
        card.style.setProperty('--priority-color', priorityConfig.color);
    }
    
    const statusConfig = plugin.statusManager.getStatusConfig(effectiveStatus);
    if (statusConfig) {
        card.style.setProperty('--current-status-color', statusConfig.color);
    }
    
    // Completion checkbox (if enabled)
    if (opts.showCheckbox) {
        const checkbox = mainRow.createEl('input', { 
            type: 'checkbox',
            cls: 'task-card__checkbox'
        });
        checkbox.checked = plugin.statusManager.isCompletedStatus(effectiveStatus);
        
        checkbox.addEventListener('click', async (e) => {
            e.stopPropagation();
            try {
                if (task.recurrence) {
                    await plugin.toggleRecurringTaskComplete(task, targetDate);
                } else {
                    await plugin.toggleTaskStatus(task);
                }
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                console.error('Error in task checkbox handler:', {
                    error: errorMessage,
                    taskPath: task.path
                });
                new Notice(`Failed to toggle task status: ${errorMessage}`);
            }
        });
    }
    
    // Status indicator dot (conditional based on visible properties)
    let statusDot: HTMLElement | null = null;
    const shouldShowStatus = !visibleProperties || visibleProperties.includes('status');
    if (shouldShowStatus) {
        statusDot = mainRow.createEl('span', { cls: 'task-card__status-dot' });
        if (statusConfig) {
            statusDot.style.borderColor = statusConfig.color;
        }
    }
    
    // Add click handler to cycle through statuses (original functionality)
    if (statusDot) {
        statusDot.addEventListener('click', async (e) => {
        e.stopPropagation();
        try {
            if (task.recurrence) {
                // For recurring tasks, toggle completion for the target date
                const updatedTask = await plugin.toggleRecurringTaskComplete(task, targetDate);
                
                // Immediately update the visual state of the status dot
                const newEffectiveStatus = getEffectiveTaskStatus(updatedTask, targetDate);
                const newStatusConfig = plugin.statusManager.getStatusConfig(newEffectiveStatus);
                const isNowCompleted = plugin.statusManager.isCompletedStatus(newEffectiveStatus);
                
                // Update status dot border color
                if (newStatusConfig) {
                    statusDot.style.borderColor = newStatusConfig.color;
                }
                
                // Update the card's completion state and classes
                const cardClasses = ['task-card'];
                if (isNowCompleted) {
                    cardClasses.push('task-card--completed');
                }
                if (task.archived) cardClasses.push('task-card--archived');
                if (plugin.getActiveTimeSession(task)) cardClasses.push('task-card--actively-tracked');
                if (task.recurrence) cardClasses.push('task-card--recurring');
                if (task.priority) cardClasses.push(`task-card--priority-${task.priority}`);
                if (newEffectiveStatus) cardClasses.push(`task-card--status-${newEffectiveStatus}`);
                
                card.className = cardClasses.join(' ');
                card.dataset.status = newEffectiveStatus;
                
                // Update the title completion styling
                const titleEl = card.querySelector('.task-card__title') as HTMLElement;
                if (titleEl) {
                    titleEl.classList.toggle('completed', isNowCompleted);
                }
            } else {
                // For regular tasks, cycle to next status
                // Get fresh task data to ensure we have the latest status
                const freshTask = await plugin.cacheManager.getTaskInfo(task.path);
                if (!freshTask) {
                    new Notice('Task not found');
                    return;
                }
                
                const currentStatus = freshTask.status || 'open';
                const nextStatus = plugin.statusManager.getNextStatus(currentStatus);
                await plugin.updateTaskProperty(freshTask, 'status', nextStatus);
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error('Error cycling task status:', {
                error: errorMessage,
                taskPath: task.path
            });
            new Notice(`Failed to update task status: ${errorMessage}`);
        }
        });
    }

    // Priority indicator dot (conditional based on visible properties)
    const shouldShowPriority = !visibleProperties || visibleProperties.includes('priority');
    if (task.priority && priorityConfig && shouldShowPriority) {
        const priorityDot = mainRow.createEl('span', { 
            cls: 'task-card__priority-dot',
            attr: { 'aria-label': `Priority: ${priorityConfig.label}` }
        });
        priorityDot.style.borderColor = priorityConfig.color;

        // Add click context menu for priority
        priorityDot.addEventListener('click', (e) => {
            e.stopPropagation(); // Don't trigger card click
            const menu = new PriorityContextMenu({
                currentValue: task.priority,
                onSelect: async (newPriority) => {
                    try {
                        await plugin.updateTaskProperty(task, 'priority', newPriority);
                    } catch (error) {
                        console.error('Error updating priority:', error);
                        new Notice('Failed to update priority');
                    }
                },
                plugin: plugin
            });
            menu.show(e as MouseEvent);
        });
    }
    
    // Recurring task indicator
    if (task.recurrence) {
        const recurringIndicator = mainRow.createEl('div', { 
            cls: 'task-card__recurring-indicator',
            attr: { 
                'aria-label': `Recurring: ${getRecurrenceDisplayText(task.recurrence)} (click to change)`
            }
        });
        setTooltip(recurringIndicator, `Recurring: ${getRecurrenceDisplayText(task.recurrence)} (click to change)`, { placement: 'top' });
        
        // Use Obsidian's built-in rotate-ccw icon for recurring tasks
        setIcon(recurringIndicator, 'rotate-ccw');
        
        // Add click context menu for recurrence
        recurringIndicator.addEventListener('click', (e) => {
            e.stopPropagation(); // Don't trigger card click
            const menu = new RecurrenceContextMenu({
                currentValue: typeof task.recurrence === 'string' ? task.recurrence : undefined,
                onSelect: async (newRecurrence: string | null) => {
                    try {
                        await plugin.updateTaskProperty(task, 'recurrence', newRecurrence || undefined);
                    } catch (error) {
                        console.error('Error updating recurrence:', error);
                        new Notice('Failed to update recurrence');
                    }
                },
                app: plugin.app
            });
            menu.show(e as MouseEvent);
        });
    }
    
    // Reminder indicator (if task has reminders)
    if (task.reminders && task.reminders.length > 0) {
        const reminderIndicator = mainRow.createEl('div', {
            cls: 'task-card__reminder-indicator',
            attr: {
                'aria-label': `${task.reminders.length} reminder${task.reminders.length > 1 ? 's' : ''} set (click to manage)`
            }
        });
        
        const count = task.reminders.length;
        const tooltip = count === 1 ? '1 reminder set (click to manage)' : `${count} reminders set (click to manage)`;
        setTooltip(reminderIndicator, tooltip, { placement: 'top' });
        
        // Use Obsidian's built-in bell icon for reminders
        setIcon(reminderIndicator, 'bell');
        
        // Add click handler to open reminder modal
        reminderIndicator.addEventListener('click', (e) => {
            e.stopPropagation(); // Don't trigger card click
            const modal = new ReminderModal(
                plugin.app,
                plugin,
                task,
                async (reminders) => {
                    try {
                        await plugin.updateTaskProperty(task, 'reminders', reminders.length > 0 ? reminders : undefined);
                    } catch (error) {
                        console.error('Error updating reminders:', error);
                        new Notice('Failed to update reminders');
                    }
                }
            );
            modal.open();
        });
    }
    
    // Project indicator (if task is used as a project)
    // Create placeholder that will be updated asynchronously
    const projectIndicatorPlaceholder = mainRow.createEl('div', { 
        cls: 'task-card__project-indicator-placeholder',
        attr: { style: 'display: none;' }
    });
    
    // Chevron for expandable subtasks (if feature is enabled)
    const chevronPlaceholder = mainRow.createEl('div', {
        cls: 'task-card__chevron-placeholder',
        attr: { style: 'display: none;' }
    });
    
    plugin.projectSubtasksService.isTaskUsedAsProject(task.path).then((isProject: boolean) => {
        if (isProject) {
            projectIndicatorPlaceholder.className = 'task-card__project-indicator';
            projectIndicatorPlaceholder.removeAttribute('style');
            projectIndicatorPlaceholder.setAttribute('aria-label', 'This task is used as a project (click to filter subtasks)');
            setTooltip(projectIndicatorPlaceholder, 'This task is used as a project (click to filter subtasks)', { placement: 'top' });
            
            // Use Obsidian's built-in folder icon for project tasks
            setIcon(projectIndicatorPlaceholder, 'folder');
            
            // Add click handler to filter subtasks
            projectIndicatorPlaceholder.addEventListener('click', async (e) => {
                e.stopPropagation(); // Don't trigger card click
                try {
                    await plugin.applyProjectSubtaskFilter(task);
                } catch (error) {
                    console.error('Error filtering project subtasks:', error);
                    new Notice('Failed to filter project subtasks');
                }
            });
            
            // Add chevron for expandable subtasks if feature is enabled
            if (plugin.settings?.showExpandableSubtasks) {
                chevronPlaceholder.className = 'task-card__chevron';
                chevronPlaceholder.removeAttribute('style');
                
                const isExpanded = plugin.expandedProjectsService?.isExpanded(task.path) || false;
                if (isExpanded) {
                    chevronPlaceholder.classList.add('task-card__chevron--expanded');
                }
                
                chevronPlaceholder.setAttribute('aria-label', isExpanded ? 'Collapse subtasks' : 'Expand subtasks');
                setTooltip(chevronPlaceholder, isExpanded ? 'Collapse subtasks' : 'Expand subtasks', { placement: 'top' });
                
                // Use Obsidian's built-in chevron-right icon
                setIcon(chevronPlaceholder, 'chevron-right');
                
                // Add click handler to toggle expansion
                chevronPlaceholder.addEventListener('click', async (e) => {
                    e.stopPropagation(); // Don't trigger card click
                    try {
                        if (!plugin.expandedProjectsService) {
                            console.error('ExpandedProjectsService not initialized');
                            new Notice('Service not available. Please try reloading the plugin.');
                            return;
                        }
                        
                        const newExpanded = plugin.expandedProjectsService.toggle(task.path);
                        chevronPlaceholder.classList.toggle('task-card__chevron--expanded', newExpanded);
                        chevronPlaceholder.setAttribute('aria-label', newExpanded ? 'Collapse subtasks' : 'Expand subtasks');
                        setTooltip(chevronPlaceholder, newExpanded ? 'Collapse subtasks' : 'Expand subtasks', { placement: 'top' });
                        
                        // Toggle subtasks display
                        await toggleSubtasks(card, task, plugin, newExpanded);
                    } catch (error) {
                        console.error('Error toggling subtasks:', error);
                        new Notice('Failed to toggle subtasks');
                    }
                });
                
                // If already expanded, show subtasks
                if (isExpanded) {
                    toggleSubtasks(card, task, plugin, true).catch(error => {
                        console.error('Error showing initial subtasks:', error);
                    });
                }
            }
        } else {
            projectIndicatorPlaceholder.remove();
            chevronPlaceholder.remove();
        }
    }).catch((error: any) => {
        console.error('Error checking if task is used as project:', error);
        projectIndicatorPlaceholder.remove();
        chevronPlaceholder.remove();
    });
    
    // Main content container
    const contentContainer = mainRow.createEl('div', { cls: 'task-card__content' });
    
    // Context menu icon (appears on hover)
    const contextIcon = mainRow.createEl('div', { 
        cls: 'task-card__context-menu',
        attr: { 
            'aria-label': 'Task options'
        }
    });
    
    // Use Obsidian's built-in ellipsis-vertical icon
    setIcon(contextIcon, 'ellipsis-vertical');
    setTooltip(contextIcon, 'Task options', { placement: 'top' });
    
    contextIcon.addEventListener('click', async (e) => {
        e.stopPropagation();
        e.preventDefault();
        await showTaskContextMenu(e as MouseEvent, task.path, plugin, targetDate);
    });
    
    // First line: Task title
    const titleEl = contentContainer.createEl('div', { 
        cls: 'task-card__title',
        text: task.title
    });
    if (plugin.statusManager.isCompletedStatus(effectiveStatus)) {
        titleEl.classList.add('completed');
    }
    
    // Second line: Metadata (dynamic based on visible properties)
    const metadataLine = contentContainer.createEl('div', { cls: 'task-card__metadata' });
    const metadataElements: HTMLElement[] = [];
    
    // Get properties to display
    const propertiesToShow = visibleProperties || 
                            plugin.settings.defaultVisibleProperties || 
                            getDefaultVisibleProperties();
    
    // Render each visible property
    for (const propertyId of propertiesToShow) {
        // Skip status and priority - they're shown as dots
        if (propertyId === 'status' || propertyId === 'priority') continue;
        
        const element = renderPropertyMetadata(metadataLine, propertyId, task, plugin);
        if (element) {
            metadataElements.push(element);
        }
    }
    
    // Legacy: Add time spent information if timeEstimate or totalTrackedTime properties are not explicitly configured
    const timeSpent = calculateTotalTimeSpent(task.timeEntries || []);
    const hasTimeEstimate = propertiesToShow.includes('timeEstimate');
    const hasTotalTrackedTime = propertiesToShow.includes('totalTrackedTime');
    if (!hasTimeEstimate && !hasTotalTrackedTime && (task.timeEstimate || timeSpent > 0)) {
        const timeInfo: string[] = [];
        if (timeSpent > 0) {
            timeInfo.push(`${plugin.formatTime(timeSpent)} spent`);
        }
        if (task.timeEstimate) {
            timeInfo.push(`${plugin.formatTime(task.timeEstimate)} estimated`);
        }
        const timeSpan = metadataLine.createEl('span', {
            cls: 'task-card__metadata-property task-card__metadata-property--time'
        });
        timeSpan.textContent = timeInfo.join(', ');
        metadataElements.push(timeSpan);
    }
    
    // Add separators between metadata elements
    addMetadataSeparators(metadataLine, metadataElements);
    
    // Add click handlers with single/double click distinction
    const { clickHandler, dblclickHandler } = createTaskClickHandler({
        task,
        plugin,
        excludeSelector: '.task-card__checkbox',
        contextMenuHandler: async (e) => {
            const path = card.dataset.taskPath;
            if (!path) return;
            await showTaskContextMenu(e, path, plugin, targetDate);
        }
    });
    
    card.addEventListener('click', clickHandler);
    card.addEventListener('dblclick', dblclickHandler);
    
    // Right-click: Context menu
    card.addEventListener('contextmenu', async (e) => {
        e.preventDefault();
        e.stopPropagation(); // Prevent event bubbling to parent task cards
        const path = card.dataset.taskPath;
        if (!path) return;

        // Pass the file path to the context menu - it will fetch fresh data
        await showTaskContextMenu(e, path, plugin, targetDate);
    });
    
    // Hover preview
    card.addEventListener('mouseover', createTaskHoverHandler(task, plugin));
    
    return card;
}

/**
 * Show context menu for task card
 */
export async function showTaskContextMenu(event: MouseEvent, taskPath: string, plugin: TaskNotesPlugin, targetDate: Date) {
    try {
        // Always fetch fresh task data - ignore any stale captured data
        const task = await plugin.cacheManager.getTaskInfo(taskPath);
        if (!task) {
            console.error(`No task found for path: ${taskPath}`);
            return;
        }
        
        const contextMenu = new TaskContextMenu({
            task: task,
            plugin: plugin,
            targetDate: targetDate,
            onUpdate: () => {
                // Trigger refresh of views
                plugin.app.workspace.trigger('tasknotes:refresh-views');
            }
        });
        
        contextMenu.show(event);
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('Error creating context menu:', {
            error: errorMessage,
            taskPath
        });
        new Notice(`Failed to create context menu: ${errorMessage}`);
    }
}

/**
 * Update an existing task card with new data
 */
export function updateTaskCard(element: HTMLElement, task: TaskInfo, plugin: TaskNotesPlugin, visibleProperties?: string[], options: Partial<TaskCardOptions> = {}): void {
    const opts = { ...DEFAULT_TASK_CARD_OPTIONS, ...options };
    const targetDate = opts.targetDate || plugin.selectedDate || new Date();
    
    // Update effective status
    const effectiveStatus = task.recurrence 
        ? getEffectiveTaskStatus(task, targetDate)
        : task.status;
    
    // Update main element classes using BEM structure
    const isActivelyTracked = plugin.getActiveTimeSession(task) !== null;
    const isCompleted = plugin.statusManager.isCompletedStatus(effectiveStatus);
    const isRecurring = !!task.recurrence;
    
    // Build BEM class names for update
    const cardClasses = ['task-card'];
    
    // Add modifiers
    if (isCompleted) cardClasses.push('task-card--completed');
    if (task.archived) cardClasses.push('task-card--archived');
    if (isActivelyTracked) cardClasses.push('task-card--actively-tracked');
    if (isRecurring) cardClasses.push('task-card--recurring');
    
    // Add priority modifier
    if (task.priority) {
        cardClasses.push(`task-card--priority-${task.priority}`);
    }
    
    // Add status modifier
    if (effectiveStatus) {
        cardClasses.push(`task-card--status-${effectiveStatus}`);
    }

    // Chevron position preference
    if (plugin.settings?.subtaskChevronPosition === 'left') {
        cardClasses.push('task-card--chevron-left');
    }

    element.className = cardClasses.join(' ');
    element.dataset.status = effectiveStatus;
    
    // Get the main row container
    const mainRow = element.querySelector('.task-card__main-row') as HTMLElement;
    
    // Update priority and status colors
    const priorityConfig = plugin.priorityManager.getPriorityConfig(task.priority);
    if (priorityConfig) {
        element.style.setProperty('--priority-color', priorityConfig.color);
    }
    
    const statusConfig = plugin.statusManager.getStatusConfig(effectiveStatus);
    if (statusConfig) {
        element.style.setProperty('--current-status-color', statusConfig.color);
    }
    
    // Update checkbox if present
    const checkbox = element.querySelector('.task-card__checkbox') as HTMLInputElement;
    if (checkbox) {
        checkbox.checked = plugin.statusManager.isCompletedStatus(effectiveStatus);
    }
    
    // Update status dot (conditional based on visible properties)
    const shouldShowStatus = !visibleProperties || visibleProperties.includes('status');
    const statusDot = element.querySelector('.task-card__status-dot') as HTMLElement;
    
    if (shouldShowStatus) {
        if (statusDot) {
            // Update existing dot
            if (statusConfig) {
                statusDot.style.borderColor = statusConfig.color;
            }
        } else if (mainRow) {
            // Add missing dot
            const newStatusDot = mainRow.createEl('span', { cls: 'task-card__status-dot' });
            if (statusConfig) {
                newStatusDot.style.borderColor = statusConfig.color;
            }
            
            // Add click handler to cycle through statuses
            newStatusDot.addEventListener('click', async (e) => {
                e.stopPropagation();
                try {
                    if (task.recurrence) {
                        // For recurring tasks, toggle completion for the target date
                        const updatedTask = await plugin.toggleRecurringTaskComplete(task, targetDate);
                        
                        // Immediately update the visual state of the status dot
                        const newEffectiveStatus = getEffectiveTaskStatus(updatedTask, targetDate);
                        const newStatusConfig = plugin.statusManager.getStatusConfig(newEffectiveStatus);
                        const isNowCompleted = plugin.statusManager.isCompletedStatus(newEffectiveStatus);
                        
                        // Update status dot border color
                        if (newStatusConfig) {
                            newStatusDot.style.borderColor = newStatusConfig.color;
                        }
                        
                        // Update the card's completion state and classes
                        const cardClasses = ['task-card'];
                        if (isNowCompleted) {
                            cardClasses.push('task-card--completed');
                        }
                        if (task.archived) cardClasses.push('task-card--archived');
                        if (plugin.getActiveTimeSession(task)) cardClasses.push('task-card--actively-tracked');
                        if (task.recurrence) cardClasses.push('task-card--recurring');
                        if (task.priority) cardClasses.push(`task-card--priority-${task.priority}`);
                        if (newEffectiveStatus) cardClasses.push(`task-card--status-${newEffectiveStatus}`);
                        
                        element.className = cardClasses.join(' ');
                        element.dataset.status = newEffectiveStatus;
                        
                        // Update the title completion styling
                        const titleEl = element.querySelector('.task-card__title') as HTMLElement;
                        if (titleEl) {
                            titleEl.classList.toggle('completed', isNowCompleted);
                        }
                    } else {
                        // For regular tasks, cycle to next status
                        // Get fresh task data to ensure we have the latest status
                        const freshTask = await plugin.cacheManager.getTaskInfo(task.path);
                        if (!freshTask) {
                            new Notice('Task not found');
                            return;
                        }
                        
                        const currentStatus = freshTask.status || 'open';
                        const nextStatus = plugin.statusManager.getNextStatus(currentStatus);
                        await plugin.updateTaskProperty(freshTask, 'status', nextStatus);
                    }
                } catch (error) {
                    const errorMessage = error instanceof Error ? error.message : String(error);
                    console.error('Error cycling task status:', {
                        error: errorMessage,
                        taskPath: task.path
                    });
                    new Notice(`Failed to update task status: ${errorMessage}`);
                }
            });
            
            // Insert at the beginning after checkbox
            const checkbox = element.querySelector('.task-card__checkbox');
            if (checkbox) {
                checkbox.insertAdjacentElement('afterend', newStatusDot);
            } else {
                mainRow.insertBefore(newStatusDot, mainRow.firstChild);
            }
        }
    } else if (statusDot) {
        // Remove dot if it shouldn't be visible
        statusDot.remove();
    }
    
    // Update priority indicator (conditional based on visible properties)
    const shouldShowPriority = !visibleProperties || visibleProperties.includes('priority');
    const existingPriorityDot = element.querySelector('.task-card__priority-dot') as HTMLElement;
    
    if (shouldShowPriority && task.priority && priorityConfig) {
        if (!existingPriorityDot && mainRow) {
            // Add priority dot if task has priority but no dot exists
            const priorityDot = mainRow.createEl('span', { 
                cls: 'task-card__priority-dot',
                attr: { 'aria-label': `Priority: ${priorityConfig.label}` }
            });
            priorityDot.style.borderColor = priorityConfig.color;

            // Add click context menu for priority
            priorityDot.addEventListener('click', (e) => {
                e.stopPropagation(); // Don't trigger card click
                const menu = new PriorityContextMenu({
                    currentValue: task.priority,
                    onSelect: async (newPriority) => {
                        try {
                            await plugin.updateTaskProperty(task, 'priority', newPriority);
                        } catch (error) {
                            console.error('Error updating priority:', error);
                            new Notice('Failed to update priority');
                        }
                    },
                    plugin: plugin
                });
                menu.show(e as MouseEvent);
            });
            
            // Insert after status dot if it exists, otherwise after checkbox
            const statusDotForInsert = element.querySelector('.task-card__status-dot');
            const checkbox = element.querySelector('.task-card__checkbox');
            if (statusDotForInsert) {
                statusDotForInsert.insertAdjacentElement('afterend', priorityDot);
            } else if (checkbox) {
                checkbox.insertAdjacentElement('afterend', priorityDot);
            } else {
                mainRow.insertBefore(priorityDot, mainRow.firstChild);
            }
        } else if (existingPriorityDot) {
            // Update existing priority dot
            existingPriorityDot.style.borderColor = priorityConfig.color;
            existingPriorityDot.setAttribute('aria-label', `Priority: ${priorityConfig.label}`);
        }
    } else if (existingPriorityDot) {
        // Remove priority dot if it shouldn't be visible or task no longer has priority
        existingPriorityDot.remove();
    }
    
    // Update recurring indicator
    const existingRecurringIndicator = element.querySelector('.task-card__recurring-indicator');
    if (task.recurrence && !existingRecurringIndicator) {
        // Add recurring indicator if task is now recurring but didn't have one
        const recurringIndicator = mainRow.createEl('span', { 
            cls: 'task-card__recurring-indicator',
            attr: { 'aria-label': `Recurring: ${getRecurrenceDisplayText(task.recurrence)}` }
        });
        setIcon(recurringIndicator, 'rotate-ccw');
        statusDot?.insertAdjacentElement('afterend', recurringIndicator);
    } else if (!task.recurrence && existingRecurringIndicator) {
        // Remove recurring indicator if task is no longer recurring
        existingRecurringIndicator.remove();
    } else if (task.recurrence && existingRecurringIndicator) {
        // Update existing recurring indicator
        const frequencyDisplay = getRecurrenceDisplayText(task.recurrence);
        existingRecurringIndicator.setAttribute('aria-label', `Recurring: ${frequencyDisplay}`);
    }

    // Update reminder indicator
    const existingReminderIndicator = element.querySelector('.task-card__reminder-indicator');
    if (task.reminders && task.reminders.length > 0 && !existingReminderIndicator) {
        // Add reminder indicator if task has reminders but didn't have one
        const reminderIndicator = mainRow.createEl('div', {
            cls: 'task-card__reminder-indicator',
            attr: {
                'aria-label': `${task.reminders.length} reminder${task.reminders.length > 1 ? 's' : ''} set (click to manage)`
            }
        });
        
        const count = task.reminders.length;
        const tooltip = count === 1 ? '1 reminder set (click to manage)' : `${count} reminders set (click to manage)`;
        setTooltip(reminderIndicator, tooltip, { placement: 'top' });
        
        setIcon(reminderIndicator, 'bell');
        
        // Add click handler to open reminder modal
        reminderIndicator.addEventListener('click', (e) => {
            e.stopPropagation(); // Don't trigger card click
            const modal = new ReminderModal(
                plugin.app,
                plugin,
                task,
                async (reminders) => {
                    try {
                        await plugin.updateTaskProperty(task, 'reminders', reminders.length > 0 ? reminders : undefined);
                    } catch (error) {
                        console.error('Error updating reminders:', error);
                        new Notice('Failed to update reminders');
                    }
                }
            );
            modal.open();
        });
        
        // Insert after the recurring indicator or status dot
        const insertAfter = existingRecurringIndicator || statusDot;
        insertAfter?.insertAdjacentElement('afterend', reminderIndicator);
    } else if ((!task.reminders || task.reminders.length === 0) && existingReminderIndicator) {
        // Remove reminder indicator if task no longer has reminders
        existingReminderIndicator.remove();
    } else if (task.reminders && task.reminders.length > 0 && existingReminderIndicator) {
        // Update existing reminder indicator
        const count = task.reminders.length;
        const tooltip = count === 1 ? '1 reminder set (click to manage)' : `${count} reminders set (click to manage)`;
        existingReminderIndicator.setAttribute('aria-label', `${count} reminder${count > 1 ? 's' : ''} set (click to manage)`);
        setTooltip(existingReminderIndicator as HTMLElement, tooltip, { placement: 'top' });
    }
    
    // Update project indicator
    const existingProjectIndicator = element.querySelector('.task-card__project-indicator');
    const existingPlaceholder = element.querySelector('.task-card__project-indicator-placeholder');
    
    plugin.projectSubtasksService.isTaskUsedAsProject(task.path).then((isProject: boolean) => {
        // Update project indicator
        if (isProject && !existingProjectIndicator && !existingPlaceholder) {
            // Add project indicator if task is now used as a project but didn't have one
            const projectIndicator = mainRow.createEl('div', { 
                cls: 'task-card__project-indicator',
                attr: { 
                    'aria-label': 'This task is used as a project (click to filter subtasks)',
                    'title': 'This task is used as a project (click to filter subtasks)'
                }
            });
            setIcon(projectIndicator, 'folder');
            
            // Add click handler to filter subtasks
            projectIndicator.addEventListener('click', async (e) => {
                e.stopPropagation();
                try {
                    await plugin.applyProjectSubtaskFilter(task);
                } catch (error) {
                    console.error('Error filtering project subtasks:', error);
                    new Notice('Failed to filter project subtasks');
                }
            });
            
            // Insert after recurring indicator or priority dot
            const insertAfter = element.querySelector('.task-card__recurring-indicator') || 
                               element.querySelector('.task-card__priority-dot') ||
                               element.querySelector('.task-card__status-dot');
            insertAfter?.insertAdjacentElement('afterend', projectIndicator);
        } else if (!isProject && (existingProjectIndicator || existingPlaceholder)) {
            // Remove project indicator if task is no longer used as a project
            existingProjectIndicator?.remove();
            existingPlaceholder?.remove();
        }
        
        // Update chevron for expandable subtasks
        const existingChevron = element.querySelector('.task-card__chevron') as HTMLElement;
        const existingChevronPlaceholder = element.querySelector('.task-card__chevron-placeholder');
        
        if (isProject && plugin.settings?.showExpandableSubtasks && !existingChevron && !existingChevronPlaceholder) {
            // Add chevron if task is now used as a project and feature is enabled
            const chevron = mainRow.createEl('div', { 
                cls: 'task-card__chevron',
                attr: { 
                    'aria-label': 'Expand subtasks',
                    'title': 'Expand subtasks'
                }
            });
            
            const isExpanded = plugin.expandedProjectsService?.isExpanded(task.path) || false;
            if (isExpanded) {
                chevron.classList.add('task-card__chevron--expanded');
                chevron.setAttribute('aria-label', 'Collapse subtasks');
                setTooltip(chevron, 'Collapse subtasks', { placement: 'top' });
            } else {
                setTooltip(chevron, 'Expand subtasks', { placement: 'top' });
            }
            
            setIcon(chevron, 'chevron-right');
            
            // Add click handler to toggle expansion
            chevron.addEventListener('click', async (e) => {
                e.stopPropagation();
                try {
                    if (!plugin.expandedProjectsService) {
                        console.error('ExpandedProjectsService not initialized in update');
                        new Notice('Service not available. Please try reloading the plugin.');
                        return;
                    }
                    
                    const newExpanded = plugin.expandedProjectsService.toggle(task.path);
                    chevron.classList.toggle('task-card__chevron--expanded', newExpanded);
                    chevron.setAttribute('aria-label', newExpanded ? 'Collapse subtasks' : 'Expand subtasks');
                    setTooltip(chevron, newExpanded ? 'Collapse subtasks' : 'Expand subtasks', { placement: 'top' });
                    
                    // Toggle subtasks display
                    await toggleSubtasks(element, task, plugin, newExpanded);
                } catch (error) {
                    console.error('Error toggling subtasks:', error);
                    new Notice('Failed to toggle subtasks');
                }
            });
            
            // Insert after project indicator
            const projectIndicator = element.querySelector('.task-card__project-indicator');
            projectIndicator?.insertAdjacentElement('afterend', chevron);
            
            // If already expanded, show subtasks
            if (isExpanded) {
                chevron.classList.add('task-card__chevron--expanded');
                chevron.setAttribute('aria-label', 'Collapse subtasks');
                setTooltip(chevron, 'Collapse subtasks', { placement: 'top' });
                
                toggleSubtasks(element, task, plugin, true).catch(error => {
                    console.error('Error showing initial subtasks in update:', error);
                });
            }
        } else if ((!isProject || !plugin.settings?.showExpandableSubtasks) && (existingChevron || existingChevronPlaceholder)) {
            // Remove chevron if task is no longer used as a project or feature is disabled
            existingChevron?.remove();
            existingChevronPlaceholder?.remove();
            // Also remove any existing subtasks container with proper cleanup
            const subtasksContainer = element.querySelector('.task-card__subtasks') as HTMLElement;
            if (subtasksContainer) {
                // Clean up the click handler
                const clickHandler = (subtasksContainer as any)._clickHandler;
                if (clickHandler) {
                    subtasksContainer.removeEventListener('click', clickHandler);
                    delete (subtasksContainer as any)._clickHandler;
                }
                subtasksContainer.remove();
            }
        }
    }).catch((error: any) => {
        console.error('Error checking if task is used as project in update:', error);
    });
    
    // Update title
    const titleEl = element.querySelector('.task-card__title') as HTMLElement;
    if (titleEl) {
        titleEl.textContent = task.title;
        titleEl.classList.toggle('completed', plugin.statusManager.isCompletedStatus(effectiveStatus));
    }
    
    // Update metadata line
    const metadataLine = element.querySelector('.task-card__metadata') as HTMLElement;
    if (metadataLine) {
        // Clear the metadata line and rebuild with DOM elements to support project links
        metadataLine.innerHTML = '';
        const metadataElements: HTMLElement[] = [];
        
        // Get properties to display
        const propertiesToShow = visibleProperties || 
                                plugin.settings.defaultVisibleProperties || 
                                getDefaultVisibleProperties();
        
        // Render each visible property
        for (const propertyId of propertiesToShow) {
            // Skip status and priority - they're shown as dots
            if (propertyId === 'status' || propertyId === 'priority') continue;
            
            const element = renderPropertyMetadata(metadataLine, propertyId, task, plugin);
            if (element) {
                metadataElements.push(element);
            }
        }
        
        // Legacy: Add time spent information if timeEstimate or totalTrackedTime properties are not explicitly configured
        const timeSpent = calculateTotalTimeSpent(task.timeEntries || []);
        const hasTimeEstimate = propertiesToShow.includes('timeEstimate');
        const hasTotalTrackedTime = propertiesToShow.includes('totalTrackedTime');
        if (!hasTimeEstimate && !hasTotalTrackedTime && (task.timeEstimate || timeSpent > 0)) {
            const timeInfo: string[] = [];
            if (timeSpent > 0) {
                timeInfo.push(`${plugin.formatTime(timeSpent)} spent`);
            }
            if (task.timeEstimate) {
                timeInfo.push(`${plugin.formatTime(task.timeEstimate)} estimated`);
            }
            const timeSpan = metadataLine.createEl('span', {
                cls: 'task-card__metadata-property task-card__metadata-property--time'
            });
            timeSpan.textContent = timeInfo.join(', ');
            metadataElements.push(timeSpan);
        }
        
        // Add separators between metadata elements
        addMetadataSeparators(metadataLine, metadataElements);
    }
    
    // Animation is now handled separately - don't add it here during reconciler updates
}

/**
 * Confirmation modal for task deletion
 */
class DeleteTaskConfirmationModal extends Modal {
    private task: TaskInfo;
    private plugin: TaskNotesPlugin;
    private onConfirm: () => Promise<void>;

    constructor(app: App, task: TaskInfo, plugin: TaskNotesPlugin, onConfirm: () => Promise<void>) {
        super(app);
        this.task = task;
        this.plugin = plugin;
        this.onConfirm = onConfirm;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();

        contentEl.createEl('h2', { text: 'Delete Task' });
        
        const description = contentEl.createEl('p');
        description.appendText('Are you sure you want to delete the task "');
        description.createEl('strong', { text: this.task.title });
        description.appendText('"?');
        
        contentEl.createEl('p', { 
            cls: 'mod-warning',
            text: 'This action cannot be undone. The task file will be permanently deleted.' 
        });

        const buttonContainer = contentEl.createEl('div', { cls: 'modal-button-container' });
        buttonContainer.style.display = 'flex';
        buttonContainer.style.gap = '10px';
        buttonContainer.style.justifyContent = 'flex-end';
        buttonContainer.style.marginTop = '20px';

        const cancelButton = buttonContainer.createEl('button', { text: 'Cancel' });
        cancelButton.addEventListener('click', () => {
            this.close();
        });

        const deleteButton = buttonContainer.createEl('button', { 
            text: 'Delete',
            cls: 'mod-warning'
        });
        deleteButton.style.backgroundColor = 'var(--color-red)';
        deleteButton.style.color = 'white';
        
        deleteButton.addEventListener('click', async () => {
            try {
                await this.onConfirm();
                this.close();
                new Notice('Task deleted successfully');
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                new Notice(`Failed to delete task: ${errorMessage}`);
                console.error('Error in delete confirmation:', error);
            }
        });

        // Focus the cancel button by default
        cancelButton.focus();
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}

/**
 * Show delete confirmation modal and handle task deletion
 */
export async function showDeleteConfirmationModal(task: TaskInfo, plugin: TaskNotesPlugin): Promise<void> {
    return new Promise((resolve, reject) => {
        const modal = new DeleteTaskConfirmationModal(
            plugin.app,
            task,
            plugin,
            async () => {
                try {
                    await plugin.taskService.deleteTask(task);
                    resolve();
                } catch (error) {
                    reject(error);
                }
            }
        );
        modal.open();
    });
}

/**
 * Check if a project string is in wikilink format [[Note Name]]
 */
function isWikilinkProject(project: string): boolean {
    return Boolean(project && project.startsWith('[[') && project.endsWith(']]'));
}

/**
 * Render project links in a container element, handling both plain text and wikilink projects
 */
function renderProjectLinks(container: HTMLElement, projects: string[], plugin: TaskNotesPlugin): void {
    container.innerHTML = '';
    
    // Flatten nested arrays and filter out null/undefined values before processing
    const validProjects = projects
        .flat(2) // Flatten up to 2 levels deep to handle nested arrays
        .filter(project => project !== null && project !== undefined && typeof project === 'string');
    
    validProjects.forEach((project, index) => {
        if (index > 0) {
            const separator = document.createTextNode(', ');
            container.appendChild(separator);
        }
        
        const plusText = document.createTextNode('+');
        container.appendChild(plusText);
        
        if (isWikilinkProject(project)) {
            // Parse the wikilink to separate path and display text
            const linkContent = project.slice(2, -2);
            let filePath = linkContent;
            let displayText = linkContent;
            
            // Handle alias syntax: [[path|alias]]
            if (linkContent.includes('|')) {
                const parts = linkContent.split('|');
                filePath = parts[0];
                displayText = parts[1];
            }
            
            // Create a clickable link showing the display text (alias if available)
            const linkEl = container.createEl('a', {
                cls: 'task-card__project-link internal-link',
                text: displayText,
                attr: { 
                    'data-href': filePath,
                    'role': 'button',
                    'tabindex': '0'
                }
            });
            
            // Add click handler to open the note
            linkEl.addEventListener('click', async (e) => {
                e.preventDefault();
                e.stopPropagation();
                
                try {
                    // Resolve the link to get the actual file
                    const file = plugin.app.metadataCache.getFirstLinkpathDest(filePath, '');
                    if (file instanceof TFile) {
                        // Open the file in the current leaf
                        await plugin.app.workspace.getLeaf(false).openFile(file);
                    } else {
                        // File not found, show notice
                        new Notice(`Note "${displayText}" not found`);
                    }
                } catch (error) {
                    console.error('Error opening project link:', error);
                    new Notice(`Failed to open note "${displayText}"`);
                }
            });
            
            // Add keyboard support for accessibility
            linkEl.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    linkEl.click();
                }
            });
            
            // Add hover preview for the project link
            linkEl.addEventListener('mouseover', (event) => {
                const file = plugin.app.metadataCache.getFirstLinkpathDest(filePath, '');
                if (file instanceof TFile) {
                    plugin.app.workspace.trigger('hover-link', {
                        event,
                        source: 'tasknotes-project-link',
                        hoverParent: container,
                        targetEl: linkEl,
                        linktext: filePath,
                        sourcePath: file.path
                    });
                }
            });
        } else {
            // Plain text project
            const textNode = document.createTextNode(project);
            container.appendChild(textNode);
        }
    });
}

/**
 * Clean up event listeners and resources for a task card
 */
export function cleanupTaskCard(card: HTMLElement): void {
    // Clean up subtasks container if it exists
    const subtasksContainer = card.querySelector('.task-card__subtasks') as HTMLElement;
    if (subtasksContainer) {
        // Clean up the click handler
        const clickHandler = (subtasksContainer as any)._clickHandler;
        if (clickHandler) {
            subtasksContainer.removeEventListener('click', clickHandler);
            delete (subtasksContainer as any)._clickHandler;
        }
    }
    
    // Note: Other event listeners on the card itself are automatically cleaned up 
    // when the card is removed from the DOM. We only need to manually clean up
    // listeners that we store references to.
}

/**
 * Toggle subtasks display for a project task card
 */
async function toggleSubtasks(card: HTMLElement, task: TaskInfo, plugin: TaskNotesPlugin, expanded: boolean): Promise<void> {
    try {
        let subtasksContainer = card.querySelector('.task-card__subtasks') as HTMLElement;
        
        if (expanded) {
            
            // Show subtasks
            if (!subtasksContainer) {
                // Create subtasks container after the main content
                subtasksContainer = document.createElement('div');
                subtasksContainer.className = 'task-card__subtasks';
                
                // Prevent clicks inside subtasks container from bubbling to parent card
                const clickHandler = (e: Event) => {
                    e.stopPropagation();
                };
                subtasksContainer.addEventListener('click', clickHandler);
                
                // Store handler reference for cleanup
                (subtasksContainer as any)._clickHandler = clickHandler;
                
                card.appendChild(subtasksContainer);
            }
            
            // Clear existing content properly (this will clean up subtask event listeners)
            while (subtasksContainer.firstChild) {
                subtasksContainer.removeChild(subtasksContainer.firstChild);
            }
        
        // Show loading state
        const loadingEl = subtasksContainer.createEl('div', { 
            cls: 'task-card__subtasks-loading',
            text: 'Loading subtasks...'
        });
        
        try {
            // Get the file for this task
            const file = plugin.app.vault.getAbstractFileByPath(task.path);
            if (!(file instanceof TFile)) {
                throw new Error('Task file not found');
            }
            
            // Get subtasks
            if (!plugin.projectSubtasksService) {
                throw new Error('projectSubtasksService not initialized');
            }
            
            const subtasks = await plugin.projectSubtasksService.getTasksLinkedToProject(file);
            
            // Apply current filter to subtasks if available
            // For now, we'll show all subtasks to keep the implementation simple
            // Future enhancement: Apply the current view's filter to subtasks
            // This could be implemented by accessing the FilterService's evaluateFilterNode method
            
            // Remove loading indicator
            loadingEl.remove();
            
            if (subtasks.length === 0) {
                subtasksContainer.createEl('div', {
                    cls: 'task-card__subtasks-loading',
                    text: 'No subtasks found'
                });
                return;
            }
            
            // Sort subtasks
            const sortedSubtasks = plugin.projectSubtasksService.sortTasks(subtasks);
            
            // Build parent chain by traversing up the DOM hierarchy
            const buildParentChain = (element: HTMLElement): string[] => {
                const chain: string[] = [];
                let current = element.closest('.task-card');
                
                while (current) {
                    const taskPath = (current as any)._taskPath;
                    if (taskPath) {
                        chain.unshift(taskPath); // Add to beginning
                    }
                    // Find next parent task card (skip current)
                    current = current.parentElement?.closest('.task-card') as HTMLElement;
                }
                return chain;
            };
            
            const parentChain = buildParentChain(card);
            
            // Render each subtask (but prevent circular references)
            for (const subtask of sortedSubtasks) {
                // Check for circular reference in the parent chain
                if (parentChain.includes(subtask.path)) {
                    console.warn('Circular reference detected in task chain:', {
                        subtask: subtask.path,
                        parentChain,
                        cycle: [...parentChain, subtask.path]
                    });
                    continue;
                }
                
                const subtaskCard = createTaskCard(subtask, plugin, undefined, {
                    showDueDate: true,
                    showCheckbox: false,
                    showArchiveButton: false,
                    showTimeTracking: false,
                    showRecurringControls: true,
                    groupByDate: false
                });
                
                // Add subtask modifier class
                subtaskCard.classList.add('task-card--subtask');
                
                subtasksContainer.appendChild(subtaskCard);
            }
            
        } catch (error) {
            console.error('Error loading subtasks:', error);
            loadingEl.textContent = 'Failed to load subtasks';
        }
        
    } else {
        // Hide subtasks
        if (subtasksContainer) {
            // Clean up the click handler
            const clickHandler = (subtasksContainer as any)._clickHandler;
            if (clickHandler) {
                subtasksContainer.removeEventListener('click', clickHandler);
                delete (subtasksContainer as any)._clickHandler;
            }
            
            // Remove the container (this will also clean up child elements and their listeners)
            subtasksContainer.remove();
        }
    }
    } catch (error) {
        console.error('Error in toggleSubtasks:', error);
        throw error;
    }
}

/**
 * Refresh expanded subtasks in parent task cards when a subtask is updated
 * This ensures that when a subtask is modified, any parent task cards that have
 * that subtask expanded will refresh their subtasks display
 */
export async function refreshParentTaskSubtasks(
    updatedTask: TaskInfo, 
    plugin: TaskNotesPlugin, 
    container: HTMLElement
): Promise<void> {
    // Only process if the updated task has projects (i.e., is a subtask)
    if (!updatedTask || !updatedTask.projects || updatedTask.projects.length === 0) {
        return;
    }
    
    // Wait for cache to contain the updated task data to prevent race condition
    // Try to get the updated task from cache, with a short retry loop
    let attempts = 0;
    const maxAttempts = 10; // Max 100ms wait
    while (attempts < maxAttempts) {
        try {
            const cachedTask = await plugin.cacheManager.getTaskInfo(updatedTask.path);
            if (cachedTask && cachedTask.dateModified === updatedTask.dateModified) {
                // Cache has been updated
                break;
            }
        } catch (error) {
            // Cache not ready yet
        }
        await new Promise(resolve => setTimeout(resolve, 10));
        attempts++;
    }
    
    // Find all expanded project task cards in the container
    const expandedChevrons = container.querySelectorAll('.task-card__chevron--expanded');
    
    for (const chevron of expandedChevrons) {
        const taskCard = chevron.closest('.task-card') as HTMLElement;
        if (!taskCard) continue;
        
        const projectTaskPath = taskCard.dataset.taskPath;
        if (!projectTaskPath) continue;
        
        // Check if this project task is referenced by the updated subtask
        const projectFile = plugin.app.vault.getAbstractFileByPath(projectTaskPath);
        if (!(projectFile instanceof TFile)) continue;
        
        const projectFileName = projectFile.basename;
        
        // Check if the updated task references this project
        const isSubtaskOfThisProject = updatedTask.projects
            .flat(2)
            .some(project => {
            if (project && typeof project === 'string' && project.startsWith('[[') && project.endsWith(']]')) {
                const linkedNoteName = project.slice(2, -2).trim();
                // Check both exact match and resolved file match
                const resolvedFile = plugin.app.metadataCache.getFirstLinkpathDest(linkedNoteName, '');
                return linkedNoteName === projectFileName || 
                       (resolvedFile && resolvedFile.path === projectTaskPath);
            }
            return project === projectFileName || project === projectTaskPath;
        });
        
        if (isSubtaskOfThisProject) {
            // Find the subtasks container
            const subtasksContainer = taskCard.querySelector('.task-card__subtasks') as HTMLElement;
            if (subtasksContainer) {
                // Re-render the subtasks by calling toggleSubtasks
                try {
                    // Get the parent task info
                    const parentTask = await plugin.cacheManager.getTaskInfo(projectTaskPath);
                    if (parentTask) {
                        // Clear and re-render subtasks
                        await toggleSubtasks(taskCard, parentTask, plugin, true);
                    }
                } catch (error) {
                    console.error('Error refreshing parent task subtasks:', error);
                }
            }
        }
    }
}
