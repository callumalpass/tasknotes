import { App, Modal } from 'obsidian';
import TaskNotesPlugin from '../main';
import { 
    normalizeDateString, 
    validateDateInput,
    hasTimeComponent,
    getDatePart,
    getTimePart,
    combineDateAndTime,
    validateDateTimeInput
} from '../utils/dateUtils';

export abstract class BaseTaskModal extends Modal {
    plugin: TaskNotesPlugin;
    
    // Form field properties
    title: string = '';
    dueDate: string = '';
    scheduledDate: string = '';
    priority: string = 'normal';
    status: string = 'open';
    contexts: string = '';
    tags: string = '';
    timeEstimate: number = 0;
    recurrence: 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly' = 'none';
    daysOfWeek: string[] = [];
    dayOfMonth: string = '';
    monthOfYear: string = '';
    
    // Time-related properties
    protected dueTimeInput?: HTMLInputElement;
    protected scheduledTimeInput?: HTMLInputElement;
    
    // Cached data
    protected existingContexts: string[] = [];
    protected existingTags: string[] = [];

    constructor(app: App, plugin: TaskNotesPlugin) {
        super(app);
        this.plugin = plugin;
    }

    // Abstract methods for subclasses to implement
    protected abstract initializeFormData(): Promise<void>;
    protected abstract createActionButtons(container: HTMLElement): void;
    protected abstract handleSubmit(): Promise<void>;

    // Get existing contexts from cache for instant autocomplete
    async getExistingContexts(): Promise<string[]> {
        return await this.plugin.cacheManager.getAllContexts();
    }

    // Get existing tags from cache for instant autocomplete  
    async getExistingTags(): Promise<string[]> {
        const allTags = await this.plugin.cacheManager.getAllTags();
        // Filter out the default task tag
        return allTags.filter(tag => tag !== this.plugin.settings.taskTag);
    }

    // Helper methods for day name conversion
    protected convertAbbreviationsToFullNames(abbreviations: string[]): string[] {
        const dayMap: Record<string, string> = {
            'mon': 'Monday',
            'tue': 'Tuesday', 
            'wed': 'Wednesday',
            'thu': 'Thursday',
            'fri': 'Friday',
            'sat': 'Saturday',
            'sun': 'Sunday'
        };
        
        return abbreviations.map(abbr => dayMap[abbr]).filter(Boolean);
    }

    protected convertFullNamesToAbbreviations(fullNames: string[]): string[] {
        const dayMap: Record<string, string> = {
            'Monday': 'mon',
            'Tuesday': 'tue',
            'Wednesday': 'wed', 
            'Thursday': 'thu',
            'Friday': 'fri',
            'Saturday': 'sat',
            'Sunday': 'sun'
        };
        
        return fullNames.map(name => dayMap[name]).filter(Boolean);
    }

    protected createFormGroup(container: HTMLElement, label: string, inputCallback: (container: HTMLElement) => void): HTMLElement {
        const formGroup = container.createDiv({ cls: 'modal-form__group' });
        const labelId = `form-label-${Math.random().toString(36).substr(2, 9)}`;
        const labelEl = formGroup.createEl('label', { 
            text: label, 
            cls: 'modal-form__label',
            attr: { 'id': labelId }
        });
        const inputContainer = formGroup.createDiv({ cls: 'modal-form__input-container' });
        inputContainer.setAttribute('aria-labelledby', labelId);
        inputCallback(inputContainer);
        return formGroup;
    }

    protected async createAutocompleteInput(
        container: HTMLElement, 
        fieldName: string, 
        getSuggestionsFn: () => Promise<string[]> | string[], 
        onChangeFn: (value: string) => void
    ): Promise<void> {
        const inputId = `autocomplete-${fieldName}-${Math.random().toString(36).substr(2, 9)}`;
        const listboxId = `listbox-${fieldName}-${Math.random().toString(36).substr(2, 9)}`;
        
        const input = container.createEl('input', {
            type: 'text',
            cls: 'modal-form__input',
            attr: {
                'id': inputId,
                'aria-label': `Enter ${fieldName} (comma-separated)`,
                'aria-autocomplete': 'list',
                'aria-expanded': 'false',
                'aria-haspopup': 'listbox',
                'role': 'combobox'
            }
        });

        input.value = (this as any)[fieldName] || '';

        input.addEventListener('input', (e) => {
            const value = (e.target as HTMLInputElement).value;
            (this as any)[fieldName] = value;
            onChangeFn(value);
        });

        input.addEventListener('focus', async () => {
            let suggestions = await getSuggestionsFn();
            
            // If suggestions are empty, try to fetch fresh data
            if (!suggestions || suggestions.length === 0) {
                if (fieldName === 'contexts') {
                    suggestions = await this.getExistingContexts();
                    this.existingContexts = suggestions;
                } else if (fieldName === 'tags') {
                    suggestions = await this.getExistingTags();
                    this.existingTags = suggestions;
                }
            }
            
            this.showSuggestions(container, suggestions, input, onChangeFn, listboxId);
        });

        input.addEventListener('blur', () => {
            window.setTimeout(() => this.hideSuggestions(container), 200);
        });

        input.addEventListener('keydown', (e) => {
            const suggestionsList = container.querySelector('.modal-form__suggestions') as HTMLElement;
            if (!suggestionsList) return;

            const suggestions = suggestionsList.querySelectorAll('.modal-form__suggestion');
            let selectedIndex = Array.from(suggestions).findIndex(el => el.hasClass('modal-form__suggestion--selected'));

            if (e.key === 'ArrowDown') {
                e.preventDefault();
                selectedIndex = (selectedIndex + 1) % suggestions.length;
                this.updateSelectedSuggestion(suggestions, selectedIndex);
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                selectedIndex = selectedIndex <= 0 ? suggestions.length - 1 : selectedIndex - 1;
                this.updateSelectedSuggestion(suggestions, selectedIndex);
            } else if (e.key === 'Enter' && selectedIndex >= 0) {
                e.preventDefault();
                const selectedSuggestion = suggestions[selectedIndex].textContent;
                if (selectedSuggestion) {
                    this.applySuggestion(input, selectedSuggestion, onChangeFn);
                }
            } else if (e.key === 'Escape') {
                this.hideSuggestions(container);
            }
        });
    }

    protected showSuggestions(
        container: HTMLElement, 
        suggestions: string[], 
        input: HTMLInputElement, 
        onChangeFn: (value: string) => void,
        listboxId?: string
    ): void {
        this.hideSuggestions(container);

        if (suggestions.length === 0) {
            input.setAttribute('aria-expanded', 'false');
            return;
        }

        const suggestionsList = container.createDiv({ 
            cls: 'modal-form__suggestions',
            attr: {
                'role': 'listbox',
                'id': listboxId || `suggestions-${Math.random().toString(36).substr(2, 9)}`,
                'aria-label': 'Suggestions'
            }
        });
        
        input.setAttribute('aria-expanded', 'true');
        input.setAttribute('aria-controls', suggestionsList.id);
        
        // Get the current partial value being typed (after the last comma)
        const inputValue = input.value;
        const lastCommaIndex = inputValue.lastIndexOf(',');
        const currentPartial = lastCommaIndex >= 0 
            ? inputValue.substring(lastCommaIndex + 1).trim().toLowerCase()
            : inputValue.toLowerCase();
        
        const filteredSuggestions = suggestions.filter(suggestion => {
            const suggestionLower = suggestion.toLowerCase();
            // Show suggestions that match the current partial input
            // or show all if input is empty/just spaces
            return currentPartial === '' || suggestionLower.includes(currentPartial);
        });

        filteredSuggestions.slice(0, 10).forEach((suggestion, index) => {
            const suggestionItem = suggestionsList.createDiv({ 
                cls: 'modal-form__suggestion',
                text: suggestion,
                attr: {
                    'role': 'option',
                    'id': `suggestion-${index}`,
                    'aria-selected': index === 0 ? 'true' : 'false',
                    'tabindex': '-1'
                }
            });

            if (index === 0) {
                suggestionItem.addClass('modal-form__suggestion--selected');
                input.setAttribute('aria-activedescendant', `suggestion-${index}`);
            }

            suggestionItem.addEventListener('click', () => {
                this.applySuggestion(input, suggestion, onChangeFn);
            });
        });
    }

    protected applySuggestion(input: HTMLInputElement, suggestion: string, onChangeFn: (value: string) => void): void {
        const currentValue = input.value;
        const lastCommaIndex = currentValue.lastIndexOf(',');
        
        let newValue: string;
        if (lastCommaIndex >= 0) {
            newValue = currentValue.substring(0, lastCommaIndex + 1) + ' ' + suggestion;
        } else {
            newValue = suggestion;
        }
        
        input.value = newValue;
        onChangeFn(newValue);
        this.hideSuggestions(input.parentElement!);
        input.focus();
    }

    protected updateSelectedSuggestion(suggestions: NodeListOf<Element>, selectedIndex: number): void {
        suggestions.forEach((suggestion, index) => {
            if (index === selectedIndex) {
                suggestion.addClass('modal-form__suggestion--selected');
                suggestion.setAttribute('aria-selected', 'true');
                // Update aria-activedescendant on the input
                const input = suggestion.closest('.modal-form__input-container')?.querySelector('input');
                if (input) {
                    input.setAttribute('aria-activedescendant', suggestion.id);
                }
            } else {
                suggestion.removeClass('modal-form__suggestion--selected');
                suggestion.setAttribute('aria-selected', 'false');
            }
        });
    }

    protected hideSuggestions(container: HTMLElement): void {
        const existingSuggestions = container.querySelector('.modal-form__suggestions');
        if (existingSuggestions) {
            existingSuggestions.remove();
            // Clean up aria attributes on the input
            const input = container.querySelector('input');
            if (input) {
                input.setAttribute('aria-expanded', 'false');
                input.removeAttribute('aria-activedescendant');
                input.removeAttribute('aria-controls');
            }
        }
    }

    protected createTitleInputWithCounter(container: HTMLElement, maxLength: number): void {
        const inputId = `title-input-${Math.random().toString(36).substr(2, 9)}`;
        const titleInput = container.createEl('input', {
            type: 'text',
            cls: 'modal-form__input modal-form__input--title',
            attr: { 
                maxlength: maxLength.toString(),
                'id': inputId,
                'aria-label': 'Task title',
                'aria-describedby': `${inputId}-counter`
            }
        });

        titleInput.value = this.title;

        const charCounter = container.createDiv({ 
            cls: 'modal-form__char-counter',
            attr: {
                'id': `${inputId}-counter`,
                'aria-live': 'polite',
                'aria-label': 'Character count'
            }
        });
        this.updateCharCounter(charCounter, this.title.length, maxLength);

        titleInput.addEventListener('input', (e) => {
            const value = (e.target as HTMLInputElement).value;
            this.title = value;
            this.updateCharCounter(charCounter, value.length, maxLength);
        });
    }

    protected updateCharCounter(counter: HTMLElement, currentLength: number, maxLength: number): void {
        counter.textContent = `${currentLength}/${maxLength}`;
        
        if (currentLength > maxLength * 0.9) {
            counter.addClass('modal-form__char-counter--warning');
        } else {
            counter.removeClass('modal-form__char-counter--warning');
        }
    }

    protected createPriorityDropdown(container: HTMLElement): void {
        const selectId = `priority-select-${Math.random().toString(36).substr(2, 9)}`;
        const select = container.createEl('select', { 
            cls: 'modal-form__select',
            attr: {
                'id': selectId,
                'aria-label': 'Task priority'
            }
        });

        this.plugin.priorityManager.getPrioritiesByWeight().forEach(priorityConfig => {
            const option = select.createEl('option', {
                value: priorityConfig.value,
                text: priorityConfig.label
            });

            if (priorityConfig.value === this.priority) {
                option.selected = true;
            }
        });

        select.addEventListener('change', (e) => {
            this.priority = (e.target as HTMLSelectElement).value;
        });
    }

    protected createStatusDropdown(container: HTMLElement): void {
        const selectId = `status-select-${Math.random().toString(36).substr(2, 9)}`;
        const select = container.createEl('select', { 
            cls: 'modal-form__select',
            attr: {
                'id': selectId,
                'aria-label': 'Task status'
            }
        });

        this.plugin.statusManager.getAllStatuses().forEach(statusConfig => {
            const option = select.createEl('option', {
                value: statusConfig.value,
                text: statusConfig.label
            });

            if (statusConfig.value === this.status) {
                option.selected = true;
            }
        });

        select.addEventListener('change', (e) => {
            this.status = (e.target as HTMLSelectElement).value;
        });
    }

    protected createDueDateInput(container: HTMLElement): void {
        const inputContainer = container.createDiv({ cls: 'modal-form__datetime-container' });
        
        // Date input
        const dateInput = inputContainer.createEl('input', {
            type: 'date',
            cls: 'modal-form__input modal-form__input--date',
            attr: {
                'aria-label': 'Due date',
                'placeholder': 'YYYY-MM-DD'
            }
        });
        
        // Extract and set date part
        const datePart = getDatePart(this.dueDate);
        if (datePart && validateDateInput(datePart)) {
            dateInput.value = datePart;
        }
        
        // Time input (always visible but optional)
        this.dueTimeInput = inputContainer.createEl('input', {
            type: 'time',
            cls: 'modal-form__input modal-form__input--time',
            attr: {
                'aria-label': 'Due time (optional)',
                'placeholder': 'HH:MM'
            }
        });
        
        // Extract and set time part
        const timePart = getTimePart(this.dueDate);
        if (timePart) {
            this.dueTimeInput.value = timePart;
        }
        
        // Event listeners
        dateInput.addEventListener('change', (e) => {
            const dateValue = (e.target as HTMLInputElement).value;
            this.updateDueDateValue(dateValue, this.dueTimeInput?.value || '');
        });
        
        this.dueTimeInput.addEventListener('change', (e) => {
            const timeValue = (e.target as HTMLInputElement).value;
            this.updateDueDateValue(dateInput.value, timeValue);
        });
    }
    
    private updateDueDateValue(dateValue: string, timeValue: string): void {
        if (!dateValue) {
            this.dueDate = '';
            return;
        }
        
        if (timeValue && timeValue.trim()) {
            this.dueDate = combineDateAndTime(dateValue, timeValue);
        } else {
            this.dueDate = dateValue;
        }
    }

    protected createScheduledDateInput(container: HTMLElement): void {
        const inputContainer = container.createDiv({ cls: 'modal-form__datetime-container' });
        
        // Date input
        const dateInput = inputContainer.createEl('input', {
            type: 'date',
            cls: 'modal-form__input modal-form__input--date',
            attr: {
                'aria-label': 'Scheduled date',
                'placeholder': 'YYYY-MM-DD'
            }
        });
        
        // Extract and set date part
        const datePart = getDatePart(this.scheduledDate);
        if (datePart && validateDateInput(datePart)) {
            dateInput.value = datePart;
        }
        
        // Time input (always visible but optional)
        this.scheduledTimeInput = inputContainer.createEl('input', {
            type: 'time',
            cls: 'modal-form__input modal-form__input--time',
            attr: {
                'aria-label': 'Scheduled time (optional)',
                'placeholder': 'HH:MM'
            }
        });
        
        // Extract and set time part
        const timePart = getTimePart(this.scheduledDate);
        if (timePart) {
            this.scheduledTimeInput.value = timePart;
        }
        
        // Event listeners
        dateInput.addEventListener('change', (e) => {
            const dateValue = (e.target as HTMLInputElement).value;
            this.updateScheduledDateValue(dateValue, this.scheduledTimeInput?.value || '');
        });
        
        this.scheduledTimeInput.addEventListener('change', (e) => {
            const timeValue = (e.target as HTMLInputElement).value;
            this.updateScheduledDateValue(dateInput.value, timeValue);
        });

        // Add help text for scheduled date
        this.createHelpText(container, 
            'When you plan to work on this task. For recurring tasks, this sets the time template - the date part is ignored and instances will appear based on the recurrence pattern.');
    }
    
    private updateScheduledDateValue(dateValue: string, timeValue: string): void {
        if (!dateValue) {
            this.scheduledDate = '';
            return;
        }
        
        if (timeValue && timeValue.trim()) {
            this.scheduledDate = combineDateAndTime(dateValue, timeValue);
        } else {
            this.scheduledDate = dateValue;
        }
    }

    protected createTimeEstimateInput(container: HTMLElement): void {
        const inputContainer = container.createDiv({ cls: 'modal-form__time-estimate' });
        const inputId = `time-estimate-input-${Math.random().toString(36).substr(2, 9)}`;
        
        const input = inputContainer.createEl('input', {
            type: 'number',
            cls: 'modal-form__input modal-form__input--number',
            attr: { 
                min: '0', 
                step: '5',
                'id': inputId,
                'aria-label': 'Time estimate in minutes',
                'aria-describedby': `${inputId}-label`
            }
        });

        // Ensure timeEstimate is properly initialized and preserved
        const currentTimeEstimate = this.timeEstimate || 0;
        input.value = currentTimeEstimate.toString();

        const label = inputContainer.createSpan({ 
            cls: 'modal-form__time-label',
            attr: { 'id': `${inputId}-label` }
        });
        this.updateTimeLabel(label, this.timeEstimate);

        input.addEventListener('input', (e) => {
            const value = parseInt((e.target as HTMLInputElement).value) || 0;
            this.timeEstimate = value;
            this.updateTimeLabel(label, value);
        });
    }

    protected updateTimeLabel(label: HTMLElement, value: number): void {
        if (value === 0) {
            label.textContent = 'No estimate';
        } else if (value < 60) {
            label.textContent = `${value} minute${value === 1 ? '' : 's'}`;
        } else {
            const hours = Math.floor(value / 60);
            const minutes = value % 60;
            let text = `${hours} hour${hours === 1 ? '' : 's'}`;
            if (minutes > 0) {
                text += ` ${minutes} minute${minutes === 1 ? '' : 's'}`;
            }
            label.textContent = text;
        }
    }

    protected createHelpText(container: HTMLElement, text: string): void {
        const helpText = container.createDiv({ 
            cls: 'modal-form__help-text',
            text: text
        });
    }

    protected createRecurrenceDropdown(container: HTMLElement): void {
        const selectId = `recurrence-select-${Math.random().toString(36).substr(2, 9)}`;
        const select = container.createEl('select', { 
            cls: 'modal-form__select',
            attr: {
                'id': selectId,
                'aria-label': 'Task recurrence pattern'
            }
        });

        const options = [
            { value: 'none', text: 'No recurrence' },
            { value: 'daily', text: 'Daily' },
            { value: 'weekly', text: 'Weekly' },
            { value: 'monthly', text: 'Monthly' },
            { value: 'yearly', text: 'Yearly' }
        ];

        options.forEach(option => {
            const optionEl = select.createEl('option', {
                value: option.value,
                text: option.text
            });

            if (option.value === this.recurrence) {
                optionEl.selected = true;
            }
        });

        select.addEventListener('change', (e) => {
            this.recurrence = (e.target as HTMLSelectElement).value as any;
            this.updateRecurrenceOptions(container.parentElement!);
        });

        // Add help text for recurrence
        this.createHelpText(container, 
            'Create recurring instances of this task. Set a scheduled date to define the time template. Use the due date to limit when recurrence stops.');
    }

    protected updateRecurrenceOptions(container: HTMLElement): void {
        const existingOptions = container.querySelector('.modal-form__recurrence-options');
        if (existingOptions) {
            existingOptions.remove();
        }

        if (this.recurrence === 'none') return;

        const optionsContainer = container.createDiv({ cls: 'modal-form__recurrence-options' });

        switch (this.recurrence) {
            case 'weekly':
                this.createDaysOfWeekSelector(optionsContainer);
                break;
            case 'monthly':
                this.createDayOfMonthSelector(optionsContainer);
                break;
            case 'yearly':
                this.createYearlySelector(optionsContainer);
                break;
        }
    }

    protected createDaysOfWeekSelector(container: HTMLElement): void {
        const label = container.createEl('label', { 
            text: 'Days of week:', 
            cls: 'modal-form__recurrence-label' 
        });

        const daysContainer = container.createDiv({ cls: 'modal-form__days-grid' });

        const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

        days.forEach(day => {
            const dayContainer = daysContainer.createDiv({ cls: 'modal-form__day-checkbox' });
            const checkboxId = `day-${day.toLowerCase()}-${Math.random().toString(36).substr(2, 9)}`;
            
            const checkbox = dayContainer.createEl('input', {
                type: 'checkbox',
                cls: 'modal-form__day-input',
                attr: {
                    'id': checkboxId,
                    'aria-label': `Include ${day} in weekly recurrence`
                }
            });

            checkbox.checked = this.daysOfWeek.includes(day);

            dayContainer.createEl('label', { 
                text: day, 
                cls: 'modal-form__day-label',
                attr: { 'for': checkboxId }
            });

            checkbox.addEventListener('change', (e) => {
                if ((e.target as HTMLInputElement).checked) {
                    if (!this.daysOfWeek.includes(day)) {
                        this.daysOfWeek.push(day);
                    }
                } else {
                    this.daysOfWeek = this.daysOfWeek.filter(d => d !== day);
                }
            });
        });
    }

    protected createDayOfMonthSelector(container: HTMLElement): void {
        const label = container.createEl('label', { 
            text: 'Day of month:', 
            cls: 'modal-form__recurrence-label' 
        });

        const input = container.createEl('input', {
            type: 'number',
            cls: 'modal-form__input',
            attr: { min: '1', max: '31' }
        });

        input.value = this.dayOfMonth;

        input.addEventListener('change', (e) => {
            this.dayOfMonth = (e.target as HTMLInputElement).value;
        });
    }

    protected createYearlySelector(container: HTMLElement): void {
        const monthLabel = container.createEl('label', { 
            text: 'Month:', 
            cls: 'modal-form__recurrence-label' 
        });

        const monthSelect = container.createEl('select', { cls: 'modal-form__select' });

        const months = [
            'January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December'
        ];

        months.forEach((month, index) => {
            const option = monthSelect.createEl('option', {
                value: (index + 1).toString(),
                text: month
            });

            if ((index + 1).toString() === this.monthOfYear) {
                option.selected = true;
            }
        });

        monthSelect.addEventListener('change', (e) => {
            this.monthOfYear = (e.target as HTMLSelectElement).value;
        });

        const dayLabel = container.createEl('label', { 
            text: 'Day:', 
            cls: 'modal-form__recurrence-label' 
        });

        const dayInput = container.createEl('input', {
            type: 'number',
            cls: 'modal-form__input',
            attr: { min: '1', max: '31' }
        });

        dayInput.value = this.dayOfMonth;

        dayInput.addEventListener('change', (e) => {
            this.dayOfMonth = (e.target as HTMLInputElement).value;
        });
    }
}