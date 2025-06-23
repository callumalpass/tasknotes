import { format } from 'date-fns';
import { TFile, Menu, setIcon, Notice, Modal, App } from 'obsidian';
import { TaskInfo } from '../types';
import TaskNotesPlugin from '../main';
import { calculateTotalTimeSpent, isDueByRRule, shouldShowRecurringTaskOnDate, getEffectiveTaskStatus, shouldUseRecurringTaskUI, getRecurringTaskCompletionText, getRecurrenceDisplayText } from '../utils/helpers';
import { 
    isSameDateSafe, 
    isBeforeDateSafe, 
    getTodayString, 
    formatDateForDisplay, 
    isToday, 
    isPastDate,
    formatDateTimeForDisplay,
    isTodayTimeAware,
    isOverdueTimeAware
} from '../utils/dateUtils';

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
 * Create a minimalist, unified task card element
 */
export function createTaskCard(task: TaskInfo, plugin: TaskNotesPlugin, options: Partial<TaskCardOptions> = {}): HTMLElement {
    const opts = { ...DEFAULT_TASK_CARD_OPTIONS, ...options };
    const targetDate = opts.targetDate || plugin.selectedDate;
    
    // Determine effective status for recurring tasks
    const effectiveStatus = task.recurrence 
        ? getEffectiveTaskStatus(task, targetDate)
        : task.status;
    
    // Main container with BEM class structure
    const card = document.createElement('div');
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
    
    
    card.className = cardClasses.join(' ');
    card.dataset.taskPath = task.path;
    card.dataset.key = task.path; // For DOMReconciler compatibility
    card.dataset.status = effectiveStatus;
    
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
        const checkbox = card.createEl('input', { 
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
    
    // Status indicator dot
    const statusDot = card.createEl('span', { cls: 'task-card__status-dot' });
    if (statusConfig) {
        statusDot.style.borderColor = statusConfig.color;
    }
    
    // Add click handler to cycle through statuses
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
    
    // Priority indicator dot
    if (task.priority && priorityConfig) {
        const priorityDot = card.createEl('span', { 
            cls: 'task-card__priority-dot',
            attr: { 'aria-label': `Priority: ${priorityConfig.label}` }
        });
        priorityDot.style.borderColor = priorityConfig.color;
    }
    
    // Recurring task indicator
    if (task.recurrence) {
        const recurringIndicator = card.createEl('div', { 
            cls: 'task-card__recurring-indicator',
            attr: { 'aria-label': `Recurring: ${getRecurrenceDisplayText(task.recurrence)}` }
        });
        
        // Use Obsidian's built-in rotate-ccw icon for recurring tasks
        setIcon(recurringIndicator, 'rotate-ccw');
    }
    
    // Main content container
    const contentContainer = card.createEl('div', { cls: 'task-card__content' });
    
    // Context menu icon (appears on hover)
    const contextIcon = card.createEl('div', { 
        cls: 'task-card__context-menu',
        attr: { 
            'aria-label': 'Task options',
            'title': 'More options'
        }
    });
    
    // Use Obsidian's built-in pencil icon
    setIcon(contextIcon, 'pencil');
    
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
    
    // Second line: Metadata
    const metadataLine = contentContainer.createEl('div', { cls: 'task-card__metadata' });
    const metadataItems: string[] = [];
    
    // Recurrence info (if recurring)
    if (task.recurrence) {
        const frequencyDisplay = getRecurrenceDisplayText(task.recurrence);
        metadataItems.push(`Recurring: ${frequencyDisplay}`);
    }
    
    // Due date (if has due date)
    if (task.due) {
        const isDueToday = isTodayTimeAware(task.due);
        const isDueOverdue = isOverdueTimeAware(task.due);
        
        if (isDueToday) {
            // For today, show time if available
            const timeDisplay = formatDateTimeForDisplay(task.due, {
                dateFormat: '',
                timeFormat: 'h:mm a',
                showTime: true
            });
            if (timeDisplay.trim() === '') {
                metadataItems.push('Due: Today');
            } else {
                metadataItems.push(`Due: Today at ${timeDisplay}`);
            }
        } else if (isDueOverdue) {
            // For overdue, show date and time if available
            const display = formatDateTimeForDisplay(task.due, {
                dateFormat: 'MMM d',
                timeFormat: 'h:mm a',
                showTime: true
            });
            metadataItems.push(`Due: ${display} (overdue)`);
        } else {
            // For future dates, show date and time if available
            const display = formatDateTimeForDisplay(task.due, {
                dateFormat: 'MMM d',
                timeFormat: 'h:mm a',
                showTime: true
            });
            metadataItems.push(`Due: ${display}`);
        }
    }
    
    // Scheduled date (if has scheduled date)
    if (task.scheduled) {
        const isScheduledToday = isTodayTimeAware(task.scheduled);
        const isScheduledPast = isOverdueTimeAware(task.scheduled);
        
        if (isScheduledToday) {
            // For today, show time if available
            const timeDisplay = formatDateTimeForDisplay(task.scheduled, {
                dateFormat: '',
                timeFormat: 'h:mm a',
                showTime: true
            });
            if (timeDisplay.trim() === '') {
                metadataItems.push('Scheduled: Today');
            } else {
                metadataItems.push(`Scheduled: Today at ${timeDisplay}`);
            }
        } else if (isScheduledPast) {
            // For past dates, show date and time if available
            const display = formatDateTimeForDisplay(task.scheduled, {
                dateFormat: 'MMM d',
                timeFormat: 'h:mm a',
                showTime: true
            });
            metadataItems.push(`Scheduled: ${display} (past)`);
        } else {
            // For future dates, show date and time if available
            const display = formatDateTimeForDisplay(task.scheduled, {
                dateFormat: 'MMM d',
                timeFormat: 'h:mm a',
                showTime: true
            });
            metadataItems.push(`Scheduled: ${display}`);
        }
    }
    
    // Contexts (if has contexts)
    if (task.contexts && task.contexts.length > 0) {
        metadataItems.push(`@${task.contexts.join(', @')}`);
    }
    
    // Time tracking (if has time estimate or logged time)
    const timeSpent = calculateTotalTimeSpent(task.timeEntries || []);
    if (task.timeEstimate || timeSpent > 0) {
        const timeInfo: string[] = [];
        if (timeSpent > 0) {
            timeInfo.push(`${plugin.formatTime(timeSpent)} spent`);
        }
        if (task.timeEstimate) {
            timeInfo.push(`${plugin.formatTime(task.timeEstimate)} estimated`);
        }
        metadataItems.push(timeInfo.join(', '));
    }
    
    // Populate metadata line
    if (metadataItems.length > 0) {
        metadataLine.textContent = metadataItems.join(' • ');
    } else {
        metadataLine.style.display = 'none';
    }
    
    // Add click handlers
    card.addEventListener('click', async (e) => {
        if (e.target === card.querySelector('.task-card__checkbox')) {
            return; // Let checkbox handle its own click
        }
        
        if (e.ctrlKey || e.metaKey) {
            // Ctrl/Cmd + Click: Open source note
            const file = plugin.app.vault.getAbstractFileByPath(task.path);
            if (file instanceof TFile) {
                plugin.app.workspace.getLeaf(false).openFile(file);
            }
        } else {
            // Left-click: Open edit modal
            await plugin.openTaskEditModal(task);
        }
    });
    
    // Right-click: Context menu
    card.addEventListener('contextmenu', async (e) => {
        e.preventDefault();
        const path = card.dataset.taskPath;
        if (!path) return;

        // Pass the file path to the context menu - it will fetch fresh data
        await showTaskContextMenu(e, path, plugin, targetDate);
    });
    
    // Hover preview
    card.addEventListener('mouseover', (event) => {
        const file = plugin.app.vault.getAbstractFileByPath(task.path);
        if (file) {
            plugin.app.workspace.trigger('hover-link', {
                event,
                source: 'tasknotes-task-card',
                hoverParent: card,
                targetEl: card,
                linktext: task.path,
                sourcePath: task.path
            });
        }
    });
    
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
        
        
        const menu = new Menu();
        
        // Quick Actions item (command palette style)
        menu.addItem((item) => {
            item.setTitle('Quick actions...');
            item.setIcon('zap');
            item.onClick(async () => {
                const { TaskActionPaletteModal } = await import('../modals/TaskActionPaletteModal');
                const modal = new TaskActionPaletteModal(plugin.app, task, plugin, targetDate);
                modal.open();
            });
        });
        
        menu.addSeparator();
        
        // For recurring tasks, only show non-completion statuses
        // For regular tasks, show all statuses
        const availableStatuses = task.recurrence 
            ? plugin.statusManager.getNonCompletionStatuses()
            : plugin.statusManager.getAllStatuses();
        
        // Direct status options (no submenu to avoid issues)
        availableStatuses.forEach(statusConfig => {
            menu.addItem((item) => {
                const isSelected = task.status === statusConfig.value;
                item.setTitle(`${statusConfig.label}`);
                item.setIcon('circle');
                if (isSelected) {
                    item.setIcon('check');
                }
                item.onClick(async () => {
                    try {
                        // Use the fresh task data that showTaskContextMenu just fetched
                        await plugin.updateTaskProperty(task, 'status', statusConfig.value);
                    } catch (error) {
                        const errorMessage = error instanceof Error ? error.message : String(error);
                        console.error('Error updating task status:', {
                            error: errorMessage,
                            taskPath: task.path
                        });
                        new Notice(`Failed to update task status: ${errorMessage}`);
                    }
                });
            });
        });
        
        // Add completion toggle for recurring tasks
        if (task.recurrence) {
            menu.addSeparator();
            
            // Check current completion status for this date
            const dateStr = format(targetDate, 'yyyy-MM-dd');
            const isCompletedForDate = task.complete_instances?.includes(dateStr) || false;
            
            menu.addItem((item) => {
                item.setTitle(isCompletedForDate ? 'Mark incomplete for this date' : 'Mark complete for this date');
                item.setIcon(isCompletedForDate ? 'x' : 'check');
                item.onClick(async () => {
                    try {
                        await plugin.toggleRecurringTaskComplete(task, targetDate);
                    } catch (error) {
                        const errorMessage = error instanceof Error ? error.message : String(error);
                        console.error('Error toggling recurring task completion:', {
                            error: errorMessage,
                            taskPath: task.path
                        });
                        new Notice(`Failed to toggle recurring task completion: ${errorMessage}`);
                    }
                });
            });
        }
        
        menu.addSeparator();
        
        // Direct priority options (no submenu to avoid issues)
        plugin.priorityManager.getPrioritiesByWeight().forEach(priorityConfig => {
            menu.addItem((item) => {
                const isSelected = task.priority === priorityConfig.value;
                item.setTitle(`Priority: ${priorityConfig.label}`);
                item.setIcon('flag');
                if (isSelected) {
                    item.setIcon('check');
                }
                item.onClick(async () => {
                    try {
                        // Use the fresh task data that showTaskContextMenu just fetched
                        await plugin.updateTaskProperty(task, 'priority', priorityConfig.value);
                    } catch (error) {
                        const errorMessage = error instanceof Error ? error.message : String(error);
                        console.error('Error updating task priority:', {
                            error: errorMessage,
                            taskPath: task.path
                        });
                        new Notice(`Failed to update task priority: ${errorMessage}`);
                    }
                });
            });
        });
        
        menu.addSeparator();
        
        // Set Due Date
        menu.addItem((item) => {
            item.setTitle('Set due date...');
            item.setIcon('calendar');
            item.onClick(() => {
                // Use the fresh task data that showTaskContextMenu just fetched
                plugin.openDueDateModal(task);
            });
        });
        
        // Set Scheduled Date
        menu.addItem((item) => {
            item.setTitle('Set scheduled date...');
            item.setIcon('calendar-clock');
            item.onClick(() => {
                // Use the fresh task data that showTaskContextMenu just fetched
                plugin.openScheduledDateModal(task);
            });
        });
        
        menu.addSeparator();
        
        // Time Tracking - determine current state from fresh task data
        menu.addItem((item) => {
            const activeSession = plugin.getActiveTimeSession(task);
            item.setTitle(activeSession ? 'Stop time tracking' : 'Start time tracking');
            item.setIcon(activeSession ? 'pause' : 'play');
            item.onClick(async () => {
                // Use the fresh task data that showTaskContextMenu just fetched
                const activeSession = plugin.getActiveTimeSession(task);
                if (activeSession) {
                    await plugin.stopTimeTracking(task);
                } else {
                    await plugin.startTimeTracking(task);
                }
            });
        });
        
        // Archive/Unarchive
        menu.addItem((item) => {
            item.setTitle(task.archived ? 'Unarchive' : 'Archive');
            item.setIcon(task.archived ? 'archive-restore' : 'archive');
            item.onClick(async () => {
                try {
                    // Use the fresh task data that showTaskContextMenu just fetched
                    await plugin.toggleTaskArchive(task);
                } catch (error) {
                    const errorMessage = error instanceof Error ? error.message : String(error);
                    console.error('Error toggling task archive:', {
                        error: errorMessage,
                        taskPath: task.path
                    });
                    new Notice(`Failed to toggle task archive: ${errorMessage}`);
                }
            });
        });
        
        menu.addSeparator();
        
        // Open Note
        menu.addItem((item) => {
            item.setTitle('Open note');
            item.setIcon('file-text');
            item.onClick(() => {
                const file = plugin.app.vault.getAbstractFileByPath(taskPath);
                if (file instanceof TFile) {
                    plugin.app.workspace.getLeaf(false).openFile(file);
                }
            });
        });
        
        // Copy Task Title
        menu.addItem((item) => {
            item.setTitle('Copy task title');
            item.setIcon('copy');
            item.onClick(() => {
                // Use the fresh task data that showTaskContextMenu just fetched
                navigator.clipboard.writeText(task.title);
            });
        });
        
        menu.addSeparator();
        
        // Delete Task
        menu.addItem((item) => {
            item.setTitle('Delete task');
            item.setIcon('trash');
            item.onClick(async () => {
                try {
                    await showDeleteConfirmationModal(task, plugin);
                } catch (error) {
                    const errorMessage = error instanceof Error ? error.message : String(error);
                    console.error('Error deleting task:', {
                        error: errorMessage,
                        taskPath: task.path
                    });
                    new Notice(`Failed to delete task: ${errorMessage}`);
                }
            });
        });
    
        menu.showAtMouseEvent(event);
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
export function updateTaskCard(element: HTMLElement, task: TaskInfo, plugin: TaskNotesPlugin, options: Partial<TaskCardOptions> = {}): void {
    const opts = { ...DEFAULT_TASK_CARD_OPTIONS, ...options };
    const targetDate = opts.targetDate || plugin.selectedDate;
    
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
    
    
    element.className = cardClasses.join(' ');
    element.dataset.status = effectiveStatus;
    
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
    
    // Update status dot
    const statusDot = element.querySelector('.task-card__status-dot') as HTMLElement;
    if (statusDot && statusConfig) {
        statusDot.style.borderColor = statusConfig.color;
    }
    
    // Update priority indicator
    const existingPriorityDot = element.querySelector('.task-card__priority-dot') as HTMLElement;
    if (task.priority && priorityConfig && !existingPriorityDot) {
        // Add priority dot if task has priority but no dot exists
        const priorityDot = element.createEl('span', { 
            cls: 'task-card__priority-dot',
            attr: { 'aria-label': `Priority: ${priorityConfig.label}` }
        });
        priorityDot.style.borderColor = priorityConfig.color;
        statusDot?.insertAdjacentElement('afterend', priorityDot);
    } else if (!task.priority && existingPriorityDot) {
        // Remove priority dot if task no longer has priority
        existingPriorityDot.remove();
    } else if (task.priority && priorityConfig && existingPriorityDot) {
        // Update existing priority dot
        existingPriorityDot.style.borderColor = priorityConfig.color;
        existingPriorityDot.setAttribute('aria-label', `Priority: ${priorityConfig.label}`);
    }
    
    // Update recurring indicator
    const existingRecurringIndicator = element.querySelector('.task-card__recurring-indicator');
    if (task.recurrence && !existingRecurringIndicator) {
        // Add recurring indicator if task is now recurring but didn't have one
        const recurringIndicator = element.createEl('span', { 
            cls: 'task-card__recurring-indicator',
            attr: { 'aria-label': `Recurring: ${getRecurrenceDisplayText(task.recurrence)}` }
        });
        statusDot?.insertAdjacentElement('afterend', recurringIndicator);
    } else if (!task.recurrence && existingRecurringIndicator) {
        // Remove recurring indicator if task is no longer recurring
        existingRecurringIndicator.remove();
    } else if (task.recurrence && existingRecurringIndicator) {
        // Update existing recurring indicator
        const frequencyDisplay = getRecurrenceDisplayText(task.recurrence);
        existingRecurringIndicator.setAttribute('aria-label', `Recurring: ${frequencyDisplay}`);
    }
    
    // Update title
    const titleEl = element.querySelector('.task-card__title') as HTMLElement;
    if (titleEl) {
        titleEl.textContent = task.title;
        titleEl.classList.toggle('completed', plugin.statusManager.isCompletedStatus(effectiveStatus));
    }
    
    // Update metadata line
    const metadataLine = element.querySelector('.task-card__metadata') as HTMLElement;
    if (metadataLine) {
        const metadataItems: string[] = [];
        
        // Recurrence info (if recurring)
        if (task.recurrence) {
            const frequencyDisplay = getRecurrenceDisplayText(task.recurrence);
            metadataItems.push(`Recurring: ${frequencyDisplay}`);
        }
        
        // Due date (if has due date)
        if (task.due) {
            const isDueToday = isTodayTimeAware(task.due);
            const isDueOverdue = isOverdueTimeAware(task.due);
            
            if (isDueToday) {
                // For today, show time if available
                const timeDisplay = formatDateTimeForDisplay(task.due, {
                    dateFormat: '',
                    timeFormat: 'h:mm a',
                    showTime: true
                });
                if (timeDisplay.trim() === '') {
                    metadataItems.push('Due: Today');
                } else {
                    metadataItems.push(`Due: Today at ${timeDisplay}`);
                }
            } else if (isDueOverdue) {
                // For overdue, show date and time if available
                const display = formatDateTimeForDisplay(task.due, {
                    dateFormat: 'MMM d',
                    timeFormat: 'h:mm a',
                    showTime: true
                });
                metadataItems.push(`Due: ${display} (overdue)`);
            } else {
                // For future dates, show date and time if available
                const display = formatDateTimeForDisplay(task.due, {
                    dateFormat: 'MMM d',
                    timeFormat: 'h:mm a',
                    showTime: true
                });
                metadataItems.push(`Due: ${display}`);
            }
        }
        
        // Scheduled date (if has scheduled date)
        if (task.scheduled) {
            const isScheduledToday = isTodayTimeAware(task.scheduled);
            const isScheduledPast = isOverdueTimeAware(task.scheduled);
            
            if (isScheduledToday) {
                // For today, show time if available
                const timeDisplay = formatDateTimeForDisplay(task.scheduled, {
                    dateFormat: '',
                    timeFormat: 'h:mm a',
                    showTime: true
                });
                if (timeDisplay.trim() === '') {
                    metadataItems.push('Scheduled: Today');
                } else {
                    metadataItems.push(`Scheduled: Today at ${timeDisplay}`);
                }
            } else if (isScheduledPast) {
                // For past dates, show date and time if available
                const display = formatDateTimeForDisplay(task.scheduled, {
                    dateFormat: 'MMM d',
                    timeFormat: 'h:mm a',
                    showTime: true
                });
                metadataItems.push(`Scheduled: ${display} (past)`);
            } else {
                // For future dates, show date and time if available
                const display = formatDateTimeForDisplay(task.scheduled, {
                    dateFormat: 'MMM d',
                    timeFormat: 'h:mm a',
                    showTime: true
                });
                metadataItems.push(`Scheduled: ${display}`);
            }
        }
        
        // Contexts (if has contexts)
        if (task.contexts && task.contexts.length > 0) {
            metadataItems.push(`@${task.contexts.join(', @')}`);
        }
        
        // Time tracking (if has time estimate or logged time)
        const timeSpent = calculateTotalTimeSpent(task.timeEntries || []);
        if (task.timeEstimate || timeSpent > 0) {
            const timeInfo: string[] = [];
            if (timeSpent > 0) {
                timeInfo.push(`${plugin.formatTime(timeSpent)} spent`);
            }
            if (task.timeEstimate) {
                timeInfo.push(`${plugin.formatTime(task.timeEstimate)} estimated`);
            }
            metadataItems.push(timeInfo.join(', '));
        }
        
        // Update metadata line
        if (metadataItems.length > 0) {
            metadataLine.textContent = metadataItems.join(' • ');
            metadataLine.style.display = '';
        } else {
            metadataLine.style.display = 'none';
        }
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
        
        const warningText = contentEl.createEl('p', { 
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
