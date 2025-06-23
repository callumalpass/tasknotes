import { App, Notice, TFile, Setting } from 'obsidian';
import { RRule } from 'rrule';
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
        // With native cache, task data is always current - no need to refetch
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
        // Handle recurrence - support both new rrule strings and old RecurrenceInfo objects
        if (this.task.recurrence) {
            if (typeof this.task.recurrence === 'string') {
                // New rrule string format
                this.recurrenceRule = this.task.recurrence;
                this.parseRRuleString(this.task.recurrence);
            } else if (typeof this.task.recurrence === 'object' && this.task.recurrence.frequency) {
                // Legacy RecurrenceInfo object - convert to rrule
                this.convertLegacyRecurrenceToRRule(this.task.recurrence);
            }
        } else {
            // No recurrence
            this.frequencyMode = 'NONE';
            this.recurrenceRule = '';
        }
    }

    private convertLegacyRecurrenceToRRule(recurrence: any): void {
        try {
            // Map legacy frequency to new format
            switch (recurrence.frequency) {
                case 'daily':
                    this.frequencyMode = 'DAILY';
                    this.rruleInterval = 1;
                    break;
                case 'weekly':
                    this.frequencyMode = 'WEEKLY';
                    this.rruleInterval = 1;
                    if (recurrence.days_of_week && recurrence.days_of_week.length > 0) {
                        // Convert legacy day abbreviations to RRule weekdays
                        const dayMap: Record<string, any> = {
                            'mon': RRule.MO,
                            'tue': RRule.TU,
                            'wed': RRule.WE,
                            'thu': RRule.TH,
                            'fri': RRule.FR,
                            'sat': RRule.SA,
                            'sun': RRule.SU
                        };
                        this.rruleByWeekday = recurrence.days_of_week
                            .map((day: string) => dayMap[day.toLowerCase()])
                            .filter((wd: any) => wd);
                    }
                    break;
                case 'monthly':
                    this.frequencyMode = 'MONTHLY';
                    this.rruleInterval = 1;
                    this.monthlyMode = 'day';
                    if (recurrence.day_of_month) {
                        this.rruleByMonthday = [recurrence.day_of_month];
                    }
                    break;
                case 'yearly':
                    this.frequencyMode = 'YEARLY';
                    this.rruleInterval = 1;
                    if (recurrence.month_of_year) {
                        this.rruleByMonth = [recurrence.month_of_year];
                    }
                    if (recurrence.day_of_month) {
                        this.rruleByMonthday = [recurrence.day_of_month];
                    }
                    break;
                default:
                    this.frequencyMode = 'NONE';
                    return;
            }

            // Generate the rrule string from the converted data
            this.recurrenceRule = this.generateRRuleString();
        } catch (error) {
            console.error('Error converting legacy recurrence to rrule:', error);
            this.frequencyMode = 'NONE';
            this.recurrenceRule = '';
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
                window.setTimeout(() => input.focus(), 50);
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
            this.createRRuleBuilder(container);
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
        if (this.frequencyMode === 'WEEKLY' && this.rruleByWeekday.length === 0) {
            new Notice('Please select at least one day for weekly recurrence');
            return;
        }

        if (this.frequencyMode === 'MONTHLY') {
            if (this.monthlyMode === 'day' && this.rruleByMonthday.length === 0) {
                new Notice('Please specify a day for monthly recurrence');
                return;
            }
            if (this.monthlyMode === 'weekday' && (this.rruleByWeekday.length === 0 || this.rruleBySetpos.length === 0)) {
                new Notice('Please specify both position and weekday for monthly recurrence');
                return;
            }
        }

        if (this.frequencyMode === 'YEARLY') {
            if (this.rruleByMonth.length === 0 || this.rruleByMonthday.length === 0) {
                new Notice('Please specify both month and day for yearly recurrence');
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
            const currentRecurrenceRule = this.recurrenceRule || '';
            const originalRecurrenceRule = typeof this.task.recurrence === 'string' 
                ? this.task.recurrence 
                : '';
            
            if (currentRecurrenceRule !== originalRecurrenceRule) {
                updates.recurrence = currentRecurrenceRule || undefined;
            }

            // If no changes detected, show message and return
            if (Object.keys(updates).length === 0) {
                new Notice('No changes detected');
                this.close();
                return;
            }

            // Call the centralized update service with current task state
            await this.plugin.taskService.updateTask(this.task, updates);

            new Notice('Task updated successfully');
            this.close();

        } catch (error) {
            console.error('Failed to save task:', error);
            new Notice('Failed to save task. Please try again.');
        }
    }
}
