import { App, Modal, Setting } from 'obsidian';
import { format, add } from 'date-fns';
import { TaskInfo } from '../types';
import TaskNotesPlugin from '../main';
import { 
    validateDateTimeInput, 
    getDatePart, 
    getTimePart,
    combineDateAndTime
} from '../utils/dateUtils';

export class DueDateModal extends Modal {
    private task: TaskInfo;
    private plugin: TaskNotesPlugin;
    private dueDateInput: HTMLInputElement;
    private dueTimeInput: HTMLInputElement;

    constructor(app: App, task: TaskInfo, plugin: TaskNotesPlugin) {
        super(app);
        this.task = task;
        this.plugin = plugin;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass('tasknotes-plugin');
        
        // Set up modal accessibility
        this.titleEl.setText('Set due date');
        this.titleEl.setAttribute('id', 'due-date-modal-title');
        this.containerEl.setAttribute('aria-labelledby', 'due-date-modal-title');
        this.containerEl.setAttribute('role', 'dialog');
        this.containerEl.setAttribute('aria-modal', 'true');

        // Task title display
        contentEl.createEl('p', { 
            text: `Task: ${this.task.title}`,
            cls: 'due-date-modal__task-title'
        });

        // Due date and time input
        const dateTimeSetting = new Setting(contentEl)
            .setName('Due Date & Time')
            .setDesc('Enter due date and optional time (leave time empty for date-only)');

        // Create a container for the date and time inputs
        const dateTimeContainer = dateTimeSetting.controlEl.createDiv({ cls: 'modal-form__datetime-container' });
        
        // Date input
        this.dueDateInput = dateTimeContainer.createEl('input', {
            type: 'date',
            cls: 'modal-form__input modal-form__input--date',
            attr: { 
                'aria-label': 'Due date for task',
                'placeholder': 'YYYY-MM-DD'
            }
        });
        this.dueDateInput.value = getDatePart(this.task.due || '');
        
        // Time input (always visible)
        this.dueTimeInput = dateTimeContainer.createEl('input', {
            type: 'time',
            cls: 'modal-form__input modal-form__input--time',
            attr: { 
                'aria-label': 'Due time for task (optional)',
                'placeholder': 'HH:MM'
            }
        });
        this.dueTimeInput.value = getTimePart(this.task.due || '') || '';
        
        // Event listeners
        this.dueDateInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                this.save();
            } else if (e.key === 'Escape') {
                this.close();
            }
        });
        
        this.dueTimeInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                this.save();
            } else if (e.key === 'Escape') {
                this.close();
            }
        });
        
        // Focus the date input
        setTimeout(() => this.dueDateInput.focus(), 100);

        // Quick date buttons
        const quickDatesContainer = contentEl.createDiv({ cls: 'modal-form__group' });
        new Setting(quickDatesContainer)
            .setName('Quick options')
            .setHeading();

        const buttonsContainer = quickDatesContainer.createDiv({ cls: 'modal-form__quick-actions' });

        // Today button
        const todayBtn = buttonsContainer.createEl('button', { 
            text: 'Today', 
            cls: 'modal-form__button modal-form__button--quick-date',
            attr: { 'aria-label': 'Set due date to today' }
        });
        todayBtn.addEventListener('click', () => {
            this.dueDateInput.value = format(new Date(), 'yyyy-MM-dd');
        });

        // Tomorrow button
        const tomorrowBtn = buttonsContainer.createEl('button', { 
            text: 'Tomorrow', 
            cls: 'modal-form__button modal-form__button--quick-date',
            attr: { 'aria-label': 'Set due date to tomorrow' }
        });
        tomorrowBtn.addEventListener('click', () => {
            this.dueDateInput.value = format(add(new Date(), { days: 1 }), 'yyyy-MM-dd');
        });

        // Next week button
        const nextWeekBtn = buttonsContainer.createEl('button', { 
            text: 'Next week', 
            cls: 'modal-form__button modal-form__button--quick-date',
            attr: { 'aria-label': 'Set due date to next week' }
        });
        nextWeekBtn.addEventListener('click', () => {
            this.dueDateInput.value = format(add(new Date(), { weeks: 1 }), 'yyyy-MM-dd');
        });

        // Now button (today with current time)
        const nowBtn = buttonsContainer.createEl('button', { 
            text: 'Now', 
            cls: 'modal-form__button modal-form__button--quick-date',
            attr: { 'aria-label': 'Set due date and time to now' }
        });
        nowBtn.addEventListener('click', () => {
            const now = new Date();
            this.dueDateInput.value = format(now, 'yyyy-MM-dd');
            this.dueTimeInput.value = format(now, 'HH:mm');
        });

        // Clear button
        const clearBtn = buttonsContainer.createEl('button', { 
            text: 'Clear', 
            cls: 'modal-form__button modal-form__button--quick-date modal-form__button--quick-date--clear',
            attr: { 'aria-label': 'Clear due date' }
        });
        clearBtn.addEventListener('click', () => {
            this.dueDateInput.value = '';
            this.dueTimeInput.value = '';
        });

        // Action buttons
        const buttonContainer = contentEl.createDiv({ cls: 'modal-form__buttons' });
        
        const saveButton = buttonContainer.createEl('button', { 
            text: 'Save',
            cls: 'modal-form__button modal-form__button--primary'
        });
        saveButton.addEventListener('click', () => this.save());

        const cancelButton = buttonContainer.createEl('button', { 
            text: 'Cancel',
            cls: 'modal-form__button modal-form__button--secondary'
        });
        cancelButton.addEventListener('click', () => this.close());
    }

    private async save() {
        const dateValue = this.dueDateInput.value.trim();
        const timeValue = this.dueTimeInput.value.trim();
        
        // Build the final date/datetime value
        let finalValue: string | undefined;
        
        if (!dateValue) {
            finalValue = undefined; // Clear the due date
        } else if (timeValue) {
            finalValue = combineDateAndTime(dateValue, timeValue);
        } else {
            finalValue = dateValue; // Date only
        }
        
        // Validate the final value
        if (!validateDateTimeInput(dateValue, timeValue)) {
            // Show error message
            const errorEl = this.contentEl.createEl('div', { 
                text: 'Please enter a valid date and time format',
                cls: 'modal-form__error',
                attr: {
                    'role': 'alert',
                    'aria-live': 'assertive'
                }
            });
            this.dueDateInput.setAttribute('aria-invalid', 'true');
            this.dueDateInput.setAttribute('aria-describedby', 'due-date-error');
            errorEl.setAttribute('id', 'due-date-error');
            setTimeout(() => {
                errorEl.remove();
                this.dueDateInput.removeAttribute('aria-invalid');
                this.dueDateInput.removeAttribute('aria-describedby');
            }, 3000);
            return;
        }

        try {
            // Use the TaskService to update the property with proper cache timing
            await this.plugin.taskService.updateProperty(
                this.task, 
                'due', 
                finalValue
            );
            this.close();
        } catch (error) {
            console.error('Failed to update due date:', error);
            const errorEl = this.contentEl.createEl('div', { 
                text: 'Failed to update due date. Please try again.',
                cls: 'modal-form__error'
            });
            setTimeout(() => errorEl.remove(), 3000);
        }
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}
