import { EditorView, WidgetType } from '@codemirror/view';
import { setIcon, Notice, setTooltip } from 'obsidian';
import { TaskInfo } from '../types';
import TaskNotesPlugin from '../main';
import { formatDateTimeForDisplay, getDatePart, getTimePart } from '../utils/dateUtils';
import { getEffectiveTaskStatus } from '../utils/helpers';
import { dispatchTaskUpdate } from './TaskLinkOverlay';
import { DateContextMenu } from '../components/DateContextMenu';
import { PriorityContextMenu } from '../components/PriorityContextMenu';
import { RecurrenceContextMenu } from '../components/RecurrenceContextMenu';
import { createTaskClickHandler, createTaskHoverHandler } from '../utils/clickHandlers';

export class TaskLinkWidget extends WidgetType {
    private taskInfo: TaskInfo;
    private plugin: TaskNotesPlugin;
    private originalText: string;
    private displayText?: string;

    constructor(taskInfo: TaskInfo, plugin: TaskNotesPlugin, originalText: string, displayText?: string) {
        super();
        this.taskInfo = taskInfo;
        this.plugin = plugin;
        this.originalText = originalText;
        this.displayText = displayText;
    }

    toDOM(view: EditorView): HTMLElement {
        // Create a standalone inline task preview with unique styling
        const container = document.createElement('span');
        
        // Determine effective status for recurring tasks (same as TaskCard)
        const targetDate = this.plugin.selectedDate || (() => {
            const now = new Date();
            return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
        })();
        const effectiveStatus = this.taskInfo.recurrence 
            ? getEffectiveTaskStatus(this.taskInfo, targetDate)
            : this.taskInfo.status;
        
        // Build class names including priority and completion modifiers
        const classNames = ['tasknotes-plugin', 'task-inline-preview'];
        if (this.taskInfo.priority) {
            classNames.push(`task-inline-preview--priority-${this.taskInfo.priority}`);
        }
        // Add completion modifier if effective status is completed
        if (this.plugin.statusManager.isCompletedStatus(effectiveStatus)) {
            classNames.push('task-inline-preview--completed');
        }
        container.className = classNames.join(' ');
        
        // Build inline content with proper DOM creation using CSS classes
        
        // Status indicator dot (BEFORE text, styled like task cards)
        const statusConfig = this.plugin.statusManager.getStatusConfig(effectiveStatus);
        const statusDot = container.createEl('span', { 
            cls: 'task-inline-preview__status-dot'
        });
        setTooltip(statusDot, `Status: ${statusConfig ? statusConfig.label : effectiveStatus}`, { placement: 'top' });
        if (statusConfig) {
            statusDot.style.borderColor = statusConfig.color;
            
            // Fill the circle if the task is completed
            const isCompleted = this.plugin.statusManager.isCompletedStatus(effectiveStatus);
            if (isCompleted) {
                statusDot.style.backgroundColor = statusConfig.color;
            } else {
                statusDot.style.backgroundColor = 'transparent';
            }
        }
        
        // Add click handler to cycle through statuses (same as TaskCard)
        statusDot.addEventListener('click', async (e) => {
            e.stopPropagation();
            e.preventDefault();
            try {
                if (this.taskInfo.recurrence) {
                    // For recurring tasks, toggle completion for the target date
                    const updatedTask = await this.plugin.toggleRecurringTaskComplete(this.taskInfo, targetDate);
                    
                    // Immediately update the visual state of the status dot
                    const newEffectiveStatus = getEffectiveTaskStatus(updatedTask, targetDate);
                    const newStatusConfig = this.plugin.statusManager.getStatusConfig(newEffectiveStatus);
                    const isNowCompleted = this.plugin.statusManager.isCompletedStatus(newEffectiveStatus);
                    
                    // Update status dot styling
                    if (newStatusConfig) {
                        statusDot.style.borderColor = newStatusConfig.color;
                        if (isNowCompleted) {
                            statusDot.style.backgroundColor = newStatusConfig.color;
                        } else {
                            statusDot.style.backgroundColor = 'transparent';
                        }
                    }
                    
                    // Update container completion styling
                    if (isNowCompleted) {
                        container.classList.add('task-inline-preview--completed');
                    } else {
                        container.classList.remove('task-inline-preview--completed');
                    }
                    
                    // Update the widget's internal task data
                    this.taskInfo = updatedTask;
                } else {
                    // For regular tasks, cycle to next status
                    const freshTask = await this.plugin.cacheManager.getTaskInfo(this.taskInfo.path);
                    if (!freshTask) {
                        return;
                    }
                    
                    const currentStatus = freshTask.status || 'open';
                    const nextStatus = this.plugin.statusManager.getNextStatus(currentStatus);
                    await this.plugin.updateTaskProperty(freshTask, 'status', nextStatus);
                    
                    // Update the widget's internal task data
                    this.taskInfo.status = nextStatus;
                    
                    // Immediately update the visual elements
                    const nextStatusConfig = this.plugin.statusManager.getStatusConfig(nextStatus);
                    if (nextStatusConfig) {
                        statusDot.style.borderColor = nextStatusConfig.color;
                    }
                    
                    // Update completion styling
                    const isCompleted = this.plugin.statusManager.isCompletedStatus(nextStatus);
                    if (isCompleted) {
                        container.classList.add('task-inline-preview--completed');
                        // Fill the circle for completed status
                        if (nextStatusConfig) {
                            statusDot.style.backgroundColor = nextStatusConfig.color;
                        }
                    } else {
                        container.classList.remove('task-inline-preview--completed');
                        // Make the circle transparent for non-completed status
                        statusDot.style.backgroundColor = 'transparent';
                    }
                }
                
                // Also trigger the system refresh for consistency
                setTimeout(() => {
                    // Validate that view is a proper EditorView with dispatch method
                    if (view && typeof view.dispatch === 'function') {
                        dispatchTaskUpdate(view, this.taskInfo.path);
                    }
                }, 50);
            } catch (error) {
                console.error('Error cycling task status in inline widget:', error);
            }
        });
        
        // Priority indicator dot (after status, BEFORE text)
        if (this.taskInfo.priority) {
            const priorityConfig = this.plugin.priorityManager.getPriorityConfig(this.taskInfo.priority);
            if (priorityConfig) {
                const priorityDot = container.createEl('span', { 
                    cls: 'task-inline-preview__priority-dot task-card__priority-dot'
                });
                setTooltip(priorityDot, `Priority: ${priorityConfig.label} (click to change)`, { placement: 'top' });
                priorityDot.style.backgroundColor = priorityConfig.color;
                
                // Add click context menu for priority (same as TaskCard)
                priorityDot.addEventListener('click', (e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    const menu = new PriorityContextMenu({
                        currentValue: this.taskInfo.priority,
                        onSelect: async (newPriority) => {
                            try {
                                await this.plugin.updateTaskProperty(this.taskInfo, 'priority', newPriority);
                                
                                // Update the widget's internal task data
                                this.taskInfo.priority = newPriority;
                                
                                // Update visual styling
                                const newPriorityConfig = this.plugin.priorityManager.getPriorityConfig(newPriority);
                                if (newPriorityConfig) {
                                    priorityDot.style.backgroundColor = newPriorityConfig.color;
                                    setTooltip(priorityDot, `Priority: ${newPriorityConfig.label} (click to change)`, { placement: 'top' });
                                }
                            } catch (error) {
                                console.error('Error updating priority:', error);
                                new Notice('Failed to update priority');
                            }
                        },
                        plugin: this.plugin
                    });
                    menu.show(e as MouseEvent);
                });
            }
        }
        
        // Task title (allow longer text)
        const titleText = this.taskInfo.title.length > 80 ? this.taskInfo.title.slice(0, 77) + '...' : this.taskInfo.title;
        container.createEl('span', { 
            cls: 'task-inline-preview__title',
            text: titleText 
        });

        // Due date info with calendar icon
        if (this.taskInfo.due) {
            // Format due date with time if available
            const displayText = formatDateTimeForDisplay(this.taskInfo.due, {
                dateFormat: 'MMM d',
                timeFormat: 'h:mm a',
                showTime: true
            });
            
            // Create tooltip with full date/time info
            const tooltipText = formatDateTimeForDisplay(this.taskInfo.due, {
                dateFormat: 'MMM d, yyyy',
                timeFormat: 'h:mm a',
                showTime: true
            });
            
            const dueDateSpan = container.createEl('span', {
                cls: 'task-inline-preview__date task-inline-preview__date--due task-card__metadata-date task-card__metadata-date--due'
            });
            setTooltip(dueDateSpan, `Due: ${tooltipText} (click to change)`, { placement: 'top' });
            
            const calendarIcon = dueDateSpan.createEl('span', { cls: 'task-inline-preview__date-icon' });
            setIcon(calendarIcon, 'calendar');
            
            dueDateSpan.appendText(displayText);
            
            // Add click context menu for due date (same as TaskCard)
            dueDateSpan.addEventListener('click', (e) => {
                e.stopPropagation();
                e.preventDefault();
                const menu = new DateContextMenu({
                    currentValue: getDatePart(this.taskInfo.due || ''),
                    currentTime: getTimePart(this.taskInfo.due || ''),
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
                            await this.plugin.updateTaskProperty(this.taskInfo, 'due', finalValue);
                            
                            // Update the widget's internal task data
                            this.taskInfo.due = finalValue;
                        } catch (error) {
                            console.error('Error updating due date:', error);
                            new Notice('Failed to update due date');
                        }
                    }
                });
                menu.show(e as MouseEvent);
            });
        }

        // Scheduled date info with clock icon
        if (this.taskInfo.scheduled && (!this.taskInfo.due || this.taskInfo.scheduled !== this.taskInfo.due)) {
            // Format scheduled date with time if available
            const displayText = formatDateTimeForDisplay(this.taskInfo.scheduled, {
                dateFormat: 'MMM d',
                timeFormat: 'h:mm a',
                showTime: true
            });
            
            // Create tooltip with full date/time info
            const tooltipText = formatDateTimeForDisplay(this.taskInfo.scheduled, {
                dateFormat: 'MMM d, yyyy',
                timeFormat: 'h:mm a',
                showTime: true
            });
            
            const scheduledSpan = container.createEl('span', {
                cls: 'task-inline-preview__date task-inline-preview__date--scheduled task-card__metadata-date task-card__metadata-date--scheduled'
            });
            setTooltip(scheduledSpan, `Scheduled: ${tooltipText} (click to change)`, { placement: 'top' });
            
            const clockIcon = scheduledSpan.createEl('span', { cls: 'task-inline-preview__date-icon' });
            setIcon(clockIcon, 'clock');
            
            scheduledSpan.appendText(displayText);
            
            // Add click context menu for scheduled date (same as TaskCard)
            scheduledSpan.addEventListener('click', (e) => {
                e.stopPropagation();
                e.preventDefault();
                const menu = new DateContextMenu({
                    currentValue: getDatePart(this.taskInfo.scheduled || ''),
                    currentTime: getTimePart(this.taskInfo.scheduled || ''),
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
                            await this.plugin.updateTaskProperty(this.taskInfo, 'scheduled', finalValue);
                            
                            // Update the widget's internal task data
                            this.taskInfo.scheduled = finalValue;
                        } catch (error) {
                            console.error('Error updating scheduled date:', error);
                            new Notice('Failed to update scheduled date');
                        }
                    }
                });
                menu.show(e as MouseEvent);
            });
        }
        
        // Recurring task indicator (only for recurring tasks)
        if (this.taskInfo.recurrence) {
            const recurringIndicator = container.createEl('span', { 
                cls: 'task-inline-preview__recurring-indicator',
                attr: { 
                    'aria-label': `Recurring task (click to change)`
                }
            });
            setTooltip(recurringIndicator, 'Recurring task (click to change)', { placement: 'top' });
            
            // Use Obsidian's built-in rotate-ccw icon for recurring tasks
            setIcon(recurringIndicator, 'rotate-ccw');
            
            // Add click context menu for recurrence (same as TaskCard)
            recurringIndicator.addEventListener('click', (e) => {
                e.stopPropagation();
                e.preventDefault();
                const menu = new RecurrenceContextMenu({
                    currentValue: typeof this.taskInfo.recurrence === 'string' ? this.taskInfo.recurrence : undefined,
                    onSelect: async (newRecurrence: string | null) => {
                        try {
                            await this.plugin.updateTaskProperty(this.taskInfo, 'recurrence', newRecurrence || undefined);
                            
                            // Update the widget's internal task data
                            this.taskInfo.recurrence = newRecurrence || undefined;
                        } catch (error) {
                            console.error('Error updating recurrence:', error);
                            new Notice('Failed to update recurrence');
                        }
                    },
                    app: this.plugin.app
                });
                menu.show(e as MouseEvent);
            });
        }
        
        // Add Lucide pencil icon
        const pencilIcon = container.createEl('span', { 
            cls: 'task-inline-preview__pencil',
            text: ''
        });
        setTooltip(pencilIcon, 'Task options', { placement: 'top' });
        setIcon(pencilIcon, 'ellipsis-vertical');
        
        // Store data for interactions
        container.dataset.taskPath = this.taskInfo.path;
        container.dataset.originalText = this.originalText;
        
        // Add drag functionality
        this.addDragHandlers(container);

		// Handle context menu on pencil icon separately
		pencilIcon.addEventListener('click', (e) => {
			e.preventDefault();
			e.stopPropagation();
			this.showTaskContextMenu(e, container);
		});

		// Set up click handlers using shared utility
		const { clickHandler, dblclickHandler } = createTaskClickHandler({
			task: this.taskInfo,
			plugin: this.plugin,
			excludeSelector: '.task-inline-preview__pencil',
		});
        
        container.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            await clickHandler(e);
        });
        
        container.addEventListener('dblclick', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            await dblclickHandler(e);
        });
        
        // Right-click - show context menu (same as task cards)
        container.addEventListener('contextmenu', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            await this.showTaskContextMenu(e, container);
        });
        
        // Hover preview using shared utility
        container.addEventListener('mouseover', createTaskHoverHandler(this.taskInfo, this.plugin));
        
        return container;
    }

    /**
     * Add drag handlers to task link widget for dragging to calendar
     */
    private addDragHandlers(container: HTMLElement): void {
        // Use the centralized drag drop manager for FullCalendar compatibility
        this.plugin.dragDropManager.makeTaskCardDraggable(container, this.taskInfo.path);
    }

    /**
     * Show the same context menu used by task cards
     */
    private async showTaskContextMenu(event: MouseEvent, container: HTMLElement): Promise<void> {
        try {
            // Import the showTaskContextMenu function from TaskCard
            const { showTaskContextMenu } = await import('../ui/TaskCard');
            const targetDate = this.plugin.selectedDate || (() => {
            const now = new Date();
            return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
        })();
            await showTaskContextMenu(event, this.taskInfo.path, this.plugin, targetDate);
        } catch (error) {
            console.error(`Error showing context menu for task ${this.taskInfo.path}:`, error);
            // Fallback to edit modal
            await this.plugin.openTaskEditModal(this.taskInfo);
        }
    }

    /**
     * Check if this widget should be updated when task data changes
     */
    eq(other: WidgetType): boolean {
        if (!(other instanceof TaskLinkWidget)) {
            return false;
        }
        return (
            this.taskInfo.path === other.taskInfo.path &&
            this.taskInfo.status === other.taskInfo.status &&
            this.taskInfo.title === other.taskInfo.title &&
            this.taskInfo.priority === other.taskInfo.priority &&
            this.taskInfo.archived === other.taskInfo.archived &&
            this.taskInfo.due === other.taskInfo.due &&
            this.taskInfo.scheduled === other.taskInfo.scheduled &&
            this.taskInfo.recurrence === other.taskInfo.recurrence &&
            JSON.stringify(this.taskInfo.complete_instances) === JSON.stringify(other.taskInfo.complete_instances) &&
            this.taskInfo.dateModified === other.taskInfo.dateModified
        );
    }

    /**
     * Indicate this widget should be treated as atomic for editing purposes
     */
    ignoreEvent(): boolean {
        return false;
    }

    /**
     * This widget should be inline, not block
     */
    get estimatedHeight(): number {
        return -1; // Indicates inline widget
    }

    /**
     * Ensure this is treated as an inline widget
     */
    get block(): boolean {
        return false;
    }
}