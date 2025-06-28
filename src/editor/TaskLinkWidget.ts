import { EditorView, WidgetType } from '@codemirror/view';
import { TFile, setIcon } from 'obsidian';
import { TaskInfo } from '../types';
import TaskNotesPlugin from '../main';
import { formatDateTimeForDisplay } from '../utils/dateUtils';
import { dispatchTaskUpdate } from './TaskLinkOverlay';

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
        
        // Build class names including priority and completion modifiers
        const classNames = ['tasknotes-plugin', 'task-inline-preview'];
        if (this.taskInfo.priority) {
            classNames.push(`task-inline-preview--priority-${this.taskInfo.priority}`);
        }
        // Add completion modifier if task status is completed
        if (this.plugin.statusManager.isCompletedStatus(this.taskInfo.status)) {
            classNames.push('task-inline-preview--completed');
        }
        container.className = classNames.join(' ');
        
        // Build inline content with proper DOM creation using CSS classes
        
        // Status indicator dot (BEFORE text, styled like task cards)
        const statusConfig = this.plugin.statusManager.getStatusConfig(this.taskInfo.status);
        const statusDot = container.createEl('span', { 
            cls: 'task-inline-preview__status-dot',
            attr: { title: `Status: ${statusConfig ? statusConfig.label : this.taskInfo.status}` }
        });
        if (statusConfig) {
            statusDot.style.borderColor = statusConfig.color;
            
            // Fill the circle if the task is completed
            const isCompleted = this.plugin.statusManager.isCompletedStatus(this.taskInfo.status);
            if (isCompleted) {
                statusDot.style.backgroundColor = statusConfig.color;
            } else {
                statusDot.style.backgroundColor = 'transparent';
            }
        }
        
        // Add click handler to cycle through statuses
        statusDot.addEventListener('click', async (e) => {
            e.stopPropagation();
            e.preventDefault();
            try {
                // Get fresh task data to ensure we have the latest status
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
                    cls: 'task-inline-preview__priority-dot',
                    attr: { title: `Priority: ${priorityConfig.label}` }
                });
                priorityDot.style.backgroundColor = priorityConfig.color;
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
                cls: 'task-inline-preview__date task-inline-preview__date--due task-inline-preview__date--clickable',
                attr: { title: `Due: ${tooltipText} (click to change)` }
            });
            
            const calendarIcon = dueDateSpan.createEl('span', { cls: 'task-inline-preview__date-icon' });
            setIcon(calendarIcon, 'calendar');
            
            dueDateSpan.appendText(displayText);
            
            // Add click handler to open due date modal
            dueDateSpan.addEventListener('click', async (e) => {
                e.stopPropagation();
                e.preventDefault();
                try {
                    const { DueDateModal } = await import('../modals/DueDateModal');
                    const modal = new DueDateModal(this.plugin.app, this.taskInfo, this.plugin);
                    modal.open();
                } catch (error) {
                    console.error('Error opening due date modal:', error);
                }
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
                cls: 'task-inline-preview__date task-inline-preview__date--scheduled task-inline-preview__date--clickable',
                attr: { title: `Scheduled: ${tooltipText} (click to change)` }
            });
            
            const clockIcon = scheduledSpan.createEl('span', { cls: 'task-inline-preview__date-icon' });
            setIcon(clockIcon, 'clock');
            
            scheduledSpan.appendText(displayText);
            
            // Add click handler to open scheduled date modal
            scheduledSpan.addEventListener('click', async (e) => {
                e.stopPropagation();
                e.preventDefault();
                try {
                    const { ScheduledDateModal } = await import('../modals/ScheduledDateModal');
                    const modal = new ScheduledDateModal(this.plugin.app, this.taskInfo, this.plugin);
                    modal.open();
                } catch (error) {
                    console.error('Error opening scheduled date modal:', error);
                }
            });
        }
        
        // Add Lucide pencil icon
        const pencilIcon = container.createEl('span', { 
            cls: 'task-inline-preview__pencil',
            attr: { 'title': 'Task options' },
            text: ''
        });
        setIcon(pencilIcon, 'pencil');
        
        // Store data for interactions
        container.dataset.taskPath = this.taskInfo.path;
        container.dataset.originalText = this.originalText;
        
        // Add drag functionality
        this.addDragHandlers(container);
        
        // Click handler - open task edit modal (same as TaskCard)
        container.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            // Check if clicking the pencil icon for context menu
            const target = e.target as HTMLElement;
            if (target === pencilIcon || pencilIcon.contains(target) || target.closest('.task-inline-preview__pencil')) {
                this.showTaskContextMenu(e, container);
                return;
            }
            
            if (e.ctrlKey || e.metaKey) {
                // Ctrl/Cmd + Click: Open source note
                const file = this.plugin.app.vault.getAbstractFileByPath(this.taskInfo.path);
                if (file instanceof TFile) {
                    this.plugin.app.workspace.getLeaf(false).openFile(file);
                }
            } else {
                // Left-click: Open edit modal
                await this.plugin.openTaskEditModal(this.taskInfo);
            }
        });
        
        // Right-click - show context menu (same as task cards)
        container.addEventListener('contextmenu', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            await this.showTaskContextMenu(e, container);
        });
        
        // Hover preview (same as TaskCard)
        container.addEventListener('mouseover', (event) => {
            const file = this.plugin.app.vault.getAbstractFileByPath(this.taskInfo.path);
            if (file) {
                this.plugin.app.workspace.trigger('hover-link', {
                    event,
                    source: 'tasknotes-task-card',
                    hoverParent: container,
                    targetEl: container,
                    linktext: this.taskInfo.path,
                    sourcePath: this.taskInfo.path
                });
            }
        });
        
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
            const targetDate = this.plugin.selectedDate || new Date();
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