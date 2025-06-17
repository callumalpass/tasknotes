import { App, Notice, TFile, Setting } from 'obsidian';
import TaskNotesPlugin from '../main';
import { BaseTaskModal } from './BaseTaskModal';
import { TaskInfo } from '../types';
import { formatTimestampForDisplay, normalizeDateString, hasTimeComponent, getDatePart, getTimePart } from '../utils/dateUtils';

export class TaskEditModal extends BaseTaskModal {
    task: TaskInfo;

    constructor(app: App, plugin: TaskNotesPlugin, task: TaskInfo) {
        super(app, plugin);
        this.task = task;
    }

    protected async initializeFormData(): Promise<void> {
        // Always ensure we have the latest task data before initialization - use forceRefresh to match openTaskEditModal behavior
        const latestTask = await this.plugin.cacheManager.getTaskInfo(this.task.path);
        if (latestTask) {
            this.task = latestTask;
        }
        
        // Initialize form fields with current task data
        this.title = this.task.title;
        // Initialize date and time components properly
        this.dueDate = this.task.due || '';
        this.scheduledDate = this.task.scheduled || '';
        // Time components will be handled by the input fields automatically
        
        this.priority = this.task.priority;
        this.status = this.task.status;
        this.contexts = this.task.contexts ? this.task.contexts.join(', ') : '';
        this.tags = this.task.tags ? this.task.tags.filter(tag => tag !== this.plugin.settings.taskTag).join(', ') : '';
        // Preserve the original time estimate value, ensuring it's not reset to 0
        this.timeEstimate = this.task.timeEstimate !== undefined ? this.task.timeEstimate : 0;
        this.recurrence = this.task.recurrence?.frequency || 'none';
        
        if (this.task.recurrence) {
            // Convert stored abbreviations to full names for UI display
            this.daysOfWeek = this.convertAbbreviationsToFullNames(this.task.recurrence.days_of_week || []);
            this.dayOfMonth = this.task.recurrence.day_of_month?.toString() || '';
            this.monthOfYear = this.task.recurrence.month_of_year?.toString() || '';
        }
    }

    async onOpen() {
        const { contentEl } = this;
        contentEl.addClass('tasknotes-plugin', 'task-edit-modal');
        new Setting(contentEl)
            .setName('Edit task')
            .setHeading();

        // Initialize form data and cache autocomplete data
        await this.initializeFormData();
        this.existingContexts = await this.getExistingContexts();
        this.existingTags = await this.getExistingTags();

        // Title with character count
        this.createFormGroup(contentEl, 'Title', (container) => {
            this.createTitleInputWithCounter(container, 200);
            
            // Auto-focus on the title field for immediate editing
            const input = container.querySelector('input');
            if (input) {
                setTimeout(() => input.focus(), 50);
            }
        });

        // Due Date
        this.createFormGroup(contentEl, 'Due date', (container) => {
            this.createDueDateInput(container);
        });

        // Scheduled Date
        this.createFormGroup(contentEl, 'Scheduled date', (container) => {
            this.createScheduledDateInput(container);
        });

        // Priority
        this.createFormGroup(contentEl, 'Priority', (container) => {
            this.createPriorityDropdown(container);
        });

        // Status
        this.createFormGroup(contentEl, 'Status', (container) => {
            this.createStatusDropdown(container);
        });

        // Contexts with autocomplete
        this.createFormGroup(contentEl, 'Contexts', (container) => {
            this.createAutocompleteInput(
                container,
                'contexts',
                () => this.existingContexts,
                (value) => { this.contexts = value; }
            );
        });

        // Tags with autocomplete
        this.createFormGroup(contentEl, 'Tags', (container) => {
            this.createAutocompleteInput(
                container,
                'tags',
                () => this.existingTags,
                (value) => { this.tags = value; }
            );
        });

        // Time Estimate
        this.createFormGroup(contentEl, 'Time estimate', (container) => {
            this.createTimeEstimateInput(container);
        });

        // Recurrence
        this.createFormGroup(contentEl, 'Recurrence', (container) => {
            this.createRecurrenceDropdown(container);
        });

        // Metadata footer
        this.createMetadataFooter(contentEl);

        // Action buttons
        this.createActionButtons(contentEl);

        // Keyboard shortcuts
        contentEl.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.close();
            } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                this.saveTask();
            }
        });
    }

    protected createActionButtons(container: HTMLElement): void {
        const buttonContainer = container.createDiv({ cls: 'modal-form__buttons' });
        
        // Open Note button
        const openButton = buttonContainer.createEl('button', { 
            text: 'Open note', 
            cls: 'modal-form__button modal-form__button--tertiary' 
        });
        openButton.addEventListener('click', () => {
            this.openNote();
        });

        // Save button
        const saveButton = buttonContainer.createEl('button', { 
            text: 'Save', 
            cls: 'modal-form__button modal-form__button--primary' 
        });
        saveButton.addEventListener('click', () => {
            this.saveTask();
        });
        
        // Cancel button
        const cancelButton = buttonContainer.createEl('button', { 
            text: 'Cancel', 
            cls: 'modal-form__button modal-form__button--secondary' 
        });
        cancelButton.addEventListener('click', () => {
            this.close();
        });
    }

    protected async handleSubmit(): Promise<void> {
        await this.saveTask();
    }

    private createMetadataFooter(container: HTMLElement): void {
        const footer = container.createDiv({ cls: 'task-edit-modal__metadata' });
        
        const metadataContainer = footer.createDiv({ cls: 'task-edit-modal__metadata-container' });
        
        if (this.task.dateCreated) {
            metadataContainer.createDiv({
                cls: 'task-edit-modal__metadata-item',
                text: `Created: ${formatTimestampForDisplay(this.task.dateCreated, 'MMM d, yyyy \'at\' h:mm a')}`
            });
        }
        
        if (this.task.dateModified) {
            metadataContainer.createDiv({
                cls: 'task-edit-modal__metadata-item',
                text: `Modified: ${formatTimestampForDisplay(this.task.dateModified, 'MMM d, yyyy \'at\' h:mm a')}`
            });
        }
    }

    private openNote(): void {
        const file = this.app.vault.getAbstractFileByPath(this.task.path);
        if (file instanceof TFile) {
            this.app.workspace.getLeaf(false).openFile(file);
            this.close();
        }
    }

    async saveTask() {
        // Validate required fields
        if (!this.title || !this.title.trim()) {
            new Notice('Title is required');
            return;
        }

        if (this.title.length > 200) {
            new Notice('Title is too long (max 200 characters)');
            return;
        }

        // Validate recurrence fields
        if (this.recurrence === 'weekly' && this.daysOfWeek.length === 0) {
            new Notice('Please select at least one day for weekly recurrence');
            return;
        }

        if (this.recurrence === 'monthly' && (!this.dayOfMonth || parseInt(this.dayOfMonth) < 1 || parseInt(this.dayOfMonth) > 31)) {
            new Notice('Please enter a valid day of month (1-31)');
            return;
        }

        if (this.recurrence === 'yearly') {
            if (!this.monthOfYear || !this.dayOfMonth) {
                new Notice('Please select month and day for yearly recurrence');
                return;
            }
            if (parseInt(this.dayOfMonth) < 1 || parseInt(this.dayOfMonth) > 31) {
                new Notice('Please enter a valid day of month (1-31)');
                return;
            }
        }

        try {
            // Prepare contexts and tags arrays
            const contextsArray = this.contexts ? this.contexts.split(',').map(c => c.trim()).filter(c => c) : [];
            const tagsArray = this.tags ? this.tags.split(',').map(t => t.trim()).filter(t => t) : [];
            
            // Add task tag if not present
            if (!tagsArray.includes(this.plugin.settings.taskTag)) {
                tagsArray.unshift(this.plugin.settings.taskTag);
            }

            // Detect changes by comparing current form values with original task
            const updates: Partial<TaskInfo> = {};

            // Check for changes in simple fields
            if (this.title !== this.task.title) {
                updates.title = this.title;
            }
            if (this.priority !== this.task.priority) {
                updates.priority = this.priority;
            }
            if (this.status !== this.task.status) {
                updates.status = this.status;
            }
            // Check for changes in date fields (compare full datetime values)
            const currentDueDate = this.dueDate || '';
            const originalDueDate = this.task.due || '';
            if (currentDueDate !== originalDueDate) {
                updates.due = this.dueDate || undefined;
            }
            
            const currentScheduledDate = this.scheduledDate || '';
            const originalScheduledDate = this.task.scheduled || '';
            if (currentScheduledDate !== originalScheduledDate) {
                updates.scheduled = this.scheduledDate || undefined;
            }
            
            // Check time estimate with proper handling of undefined vs 0
            const originalTimeEstimate = this.task.timeEstimate !== undefined ? this.task.timeEstimate : 0;
            if (this.timeEstimate !== originalTimeEstimate) {
                updates.timeEstimate = this.timeEstimate > 0 ? this.timeEstimate : undefined;
            }

            // Check for changes in contexts array
            const originalContexts = this.task.contexts || [];
            const arraysEqual = (a: string[], b: string[]) => a.length === b.length && a.every((val, index) => val === b[index]);
            if (!arraysEqual(contextsArray, originalContexts)) {
                updates.contexts = contextsArray.length > 0 ? contextsArray : undefined;
            }

            // Check for changes in tags array
            const originalTags = this.task.tags || [];
            if (!arraysEqual(tagsArray, originalTags)) {
                updates.tags = tagsArray;
            }

            // Check for changes in recurrence
            const currentRecurrence = this.recurrence !== 'none' ? {
                frequency: this.recurrence,
                days_of_week: this.recurrence === 'weekly' ? this.convertFullNamesToAbbreviations(this.daysOfWeek) : undefined,
                day_of_month: (this.recurrence === 'monthly' || this.recurrence === 'yearly') && this.dayOfMonth ? parseInt(this.dayOfMonth) : undefined,
                month_of_year: this.recurrence === 'yearly' && this.monthOfYear ? parseInt(this.monthOfYear) : undefined
            } : undefined;
            
            const originalRecurrence = this.task.recurrence;
            const recurrenceChanged = JSON.stringify(currentRecurrence) !== JSON.stringify(originalRecurrence);
            if (recurrenceChanged) {
                updates.recurrence = currentRecurrence;
            }

            // If no changes detected, show message and return
            if (Object.keys(updates).length === 0) {
                new Notice('No changes detected');
                this.close();
                return;
            }

            // Get the absolute latest task state before saving to prevent overwrites - use consistent forceRefresh
            const currentTask = await this.plugin.cacheManager.getTaskInfo(this.task.path) || this.task;
            
            // Call the centralized update service with current state
            await this.plugin.taskService.updateTask(currentTask, updates);

            new Notice('Task updated successfully');
            this.close();

        } catch (error) {
            console.error('Failed to save task:', error);
            new Notice('Failed to save task. Please try again.');
        }
    }
}
