import { App, Notice } from 'obsidian';
import TaskNotesPlugin from '../main';
import { MinimalistTaskModal } from './MinimalistTaskModal';
import { TaskInfo } from '../types';
import { getCurrentTimestamp } from '../utils/dateUtils';
import { formatTimestampForDisplay } from '../utils/dateUtils';

export interface TaskEditOptions {
    task: TaskInfo;
    onTaskUpdated?: (task: TaskInfo) => void;
}

export class MinimalistTaskEditModal extends MinimalistTaskModal {
    private task: TaskInfo;
    private options: TaskEditOptions;
    private metadataContainer: HTMLElement;

    constructor(app: App, plugin: TaskNotesPlugin, options: TaskEditOptions) {
        super(app, plugin);
        this.task = options.task;
        this.options = options;
    }

    getModalTitle(): string {
        return 'Edit Task';
    }

    async initializeFormData(): Promise<void> {
        // Initialize form fields with current task data
        this.title = this.task.title;
        this.dueDate = this.task.due || '';
        this.scheduledDate = this.task.scheduled || '';
        this.priority = this.task.priority;
        this.status = this.task.status;
        this.contexts = this.task.contexts ? this.task.contexts.join(', ') : '';
        this.tags = this.task.tags 
            ? this.task.tags.filter(tag => tag !== this.plugin.settings.taskTag).join(', ') 
            : '';
        this.timeEstimate = this.task.timeEstimate || 0;
        
        // Handle recurrence - support both new rrule strings and old RecurrenceInfo objects
        if (this.task.recurrence) {
            if (typeof this.task.recurrence === 'string') {
                this.recurrenceRule = this.task.recurrence;
            } else if (typeof this.task.recurrence === 'object' && this.task.recurrence.frequency) {
                // Legacy recurrence object - convert to string representation for display
                this.recurrenceRule = this.convertLegacyRecurrenceToString(this.task.recurrence);
            }
        } else {
            this.recurrenceRule = '';
        }

        // Extract details from task content if available
        this.details = this.extractDetailsFromTask(this.task);
    }

    private extractDetailsFromTask(task: TaskInfo): string {
        // If the task has additional content beyond the title, extract it as details
        // This is a simplified approach - you might want to implement more sophisticated parsing
        return ''; // For now, start with empty details
    }

    private convertLegacyRecurrenceToString(recurrence: any): string {
        // Convert legacy recurrence object to a readable string
        // This is for display purposes in the edit modal
        if (!recurrence.frequency) return '';
        
        let recurrenceText = recurrence.frequency;
        
        if (recurrence.frequency === 'weekly' && recurrence.days_of_week) {
            recurrenceText += ` on ${recurrence.days_of_week.join(', ')}`;
        }
        
        if (recurrence.frequency === 'monthly' && recurrence.day_of_month) {
            recurrenceText += ` on day ${recurrence.day_of_month}`;
        }
        
        return recurrenceText;
    }

    onOpen() {
        this.containerEl.addClass('tasknotes-plugin', 'minimalist-task-modal');
        this.titleEl.textContent = this.getModalTitle();
        
        this.initializeFormData().then(() => {
            this.createModalContent();
            // Update icon states after creating the action bar
            this.updateIconStates();
            this.focusTitleInput();
        });
    }

    protected createModalContent(): void {
        const { contentEl } = this;
        contentEl.empty();

        // Create main container
        const container = contentEl.createDiv('minimalist-modal-container');

        // Create action bar with icons  
        this.createActionBar(container);

        // Create expanded details section (always expanded for editing)
        this.createDetailsSection(container);

        // Create metadata section (for edit modal)
        this.createMetadataSection(container);

        // Create save/cancel buttons
        this.createActionButtons(container);
    }

    private createMetadataSection(container: HTMLElement): void {
        this.metadataContainer = container.createDiv('metadata-container');
        
        const metadataLabel = this.metadataContainer.createDiv('detail-label');
        metadataLabel.textContent = 'Task Information';
        
        const metadataContent = this.metadataContainer.createDiv('metadata-content');
        
        // Created date
        if (this.task.dateCreated) {
            const createdDiv = metadataContent.createDiv('metadata-item');
            createdDiv.createSpan('metadata-key').textContent = 'Created: ';
            createdDiv.createSpan('metadata-value').textContent = formatTimestampForDisplay(this.task.dateCreated);
        }
        
        // Modified date
        if (this.task.dateModified) {
            const modifiedDiv = metadataContent.createDiv('metadata-item');
            modifiedDiv.createSpan('metadata-key').textContent = 'Modified: ';
            modifiedDiv.createSpan('metadata-value').textContent = formatTimestampForDisplay(this.task.dateModified);
        }
        
        // File path (if available)
        if (this.task.path) {
            const pathDiv = metadataContent.createDiv('metadata-item');
            pathDiv.createSpan('metadata-key').textContent = 'File: ';
            pathDiv.createSpan('metadata-value').textContent = this.task.path;
        }
    }

    async handleSave(): Promise<void> {
        if (!this.validateForm()) {
            new Notice('Please enter a task title');
            return;
        }

        try {
            const changes = this.getChanges();
            
            if (Object.keys(changes).length === 0) {
                new Notice('No changes to save');
                this.close();
                return;
            }

            const updatedTask = await this.plugin.taskService.updateTask(this.task, changes);

            new Notice(`Task "${updatedTask.title}" updated successfully`);
            
            if (this.options.onTaskUpdated) {
                this.options.onTaskUpdated(updatedTask);
            }

        } catch (error) {
            console.error('Failed to update task:', error);
            new Notice('Failed to update task: ' + error.message);
        }
    }

    private getChanges(): Partial<TaskInfo> {
        const changes: Partial<TaskInfo> = {};

        // Check for changes and only include modified fields
        if (this.title.trim() !== this.task.title) {
            changes.title = this.title.trim();
        }

        if (this.dueDate !== (this.task.due || '')) {
            changes.due = this.dueDate || undefined;
        }

        if (this.scheduledDate !== (this.task.scheduled || '')) {
            changes.scheduled = this.scheduledDate || undefined;
        }

        if (this.priority !== this.task.priority) {
            changes.priority = this.priority;
        }

        if (this.status !== this.task.status) {
            changes.status = this.status;
        }

        // Parse and compare contexts
        const newContexts = this.contexts
            .split(',')
            .map(c => c.trim())
            .filter(c => c.length > 0);
        const oldContexts = this.task.contexts || [];
        
        if (JSON.stringify(newContexts.sort()) !== JSON.stringify(oldContexts.sort())) {
            changes.contexts = newContexts.length > 0 ? newContexts : undefined;
        }

        // Parse and compare tags
        const newTags = this.tags
            .split(',')
            .map(t => t.trim())
            .filter(t => t.length > 0);
        
        // Add the task tag if it's not already present
        if (this.plugin.settings.taskTag && !newTags.includes(this.plugin.settings.taskTag)) {
            newTags.push(this.plugin.settings.taskTag);
        }
        
        const oldTags = this.task.tags || [];
        
        if (JSON.stringify(newTags.sort()) !== JSON.stringify(oldTags.sort())) {
            changes.tags = newTags.length > 0 ? newTags : undefined;
        }

        // Compare time estimate
        const newTimeEstimate = this.timeEstimate > 0 ? this.timeEstimate : undefined;
        const oldTimeEstimate = this.task.timeEstimate;
        
        if (newTimeEstimate !== oldTimeEstimate) {
            changes.timeEstimate = newTimeEstimate;
        }

        // Compare recurrence
        const oldRecurrence = typeof this.task.recurrence === 'string' 
            ? this.task.recurrence 
            : '';
            
        if (this.recurrenceRule !== oldRecurrence) {
            changes.recurrence = this.recurrenceRule || undefined;
        }

        // Always update modified timestamp if there are changes
        if (Object.keys(changes).length > 0) {
            changes.dateModified = getCurrentTimestamp();
        }

        return changes;
    }

    // Start expanded for edit modal - override parent property
    protected isExpanded = true;
}