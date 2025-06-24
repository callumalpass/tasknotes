import { App, Modal } from 'obsidian';
import { RRule, Frequency, Weekday } from 'rrule';
import TaskNotesPlugin from '../main';
import { 
    validateDateInput,
    getDatePart,
    getTimePart,
    combineDateAndTime
} from '../utils/dateUtils';

export abstract class BaseTaskModal extends Modal {
    plugin: TaskNotesPlugin;
    
    // Form field properties
    title = '';
    dueDate = '';
    scheduledDate = '';
    priority = 'normal';
    status = 'open';
    contexts = '';
    tags = '';
    timeEstimate = 0;
    
    // RRule-based recurrence properties
    recurrenceRule = ''; // The actual rrule string
    rruleFreq: Frequency | null = null;
    rruleInterval = 1;
    rruleByWeekday: Weekday[] = [];
    rruleByMonthday: number[] = [];
    rruleByMonth: number[] = [];
    rruleBySetpos: number[] = []; // For nth weekday of month patterns
    rruleUntil: Date | null = null;
    rruleCount: number | null = null;
    
    // UI state properties
    protected frequencyMode: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY' | 'NONE' = 'NONE';
    protected monthlyMode: 'day' | 'weekday' = 'day';
    protected endMode: 'never' | 'until' | 'count' = 'never';
    
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
        try {
            return this.plugin.cacheManager.getAllContexts();
        } catch (error) {
            console.error('Failed to get existing contexts:', error);
            return this.existingContexts; // Return cached data as fallback
        }
    }

    // Get existing tags from cache for instant autocomplete  
    async getExistingTags(): Promise<string[]> {
        const allTags = this.plugin.cacheManager.getAllTags();
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

    // RRule helper methods
    protected parseRRuleString(rruleString: string): void {
        if (!rruleString) {
            this.resetRRuleProperties();
            return;
        }

        try {
            const rule = RRule.fromString(rruleString);
            const options = rule.options;

            // Set frequency mode
            switch (options.freq) {
                case Frequency.DAILY:
                    this.frequencyMode = 'DAILY';
                    break;
                case Frequency.WEEKLY:
                    this.frequencyMode = 'WEEKLY';
                    break;
                case Frequency.MONTHLY:
                    this.frequencyMode = 'MONTHLY';
                    break;
                case Frequency.YEARLY:
                    this.frequencyMode = 'YEARLY';
                    break;
                default:
                    this.frequencyMode = 'NONE';
                    return;
            }

            // Set interval
            this.rruleInterval = options.interval || 1;

            // Set weekdays for weekly recurrence
            if (options.byweekday) {
                this.rruleByWeekday = Array.isArray(options.byweekday) 
                    ? (options.byweekday as number[]).map(wd => ({ weekday: wd })) as Weekday[]
                    : [{ weekday: options.byweekday as number } as Weekday];
            }

            // Set monthday for monthly/yearly recurrence
            if (options.bymonthday) {
                this.rruleByMonthday = Array.isArray(options.bymonthday) 
                    ? options.bymonthday
                    : [options.bymonthday];
            }

            // Set month for yearly recurrence
            if (options.bymonth) {
                this.rruleByMonth = Array.isArray(options.bymonth) 
                    ? options.bymonth
                    : [options.bymonth];
            }

            // Set setpos for nth weekday patterns
            if (options.bysetpos) {
                this.rruleBySetpos = Array.isArray(options.bysetpos) 
                    ? options.bysetpos
                    : [options.bysetpos];
            }

            // Set end conditions
            if (options.until) {
                this.endMode = 'until';
                this.rruleUntil = options.until;
            } else if (options.count) {
                this.endMode = 'count';
                this.rruleCount = options.count;
            } else {
                this.endMode = 'never';
            }

            // Determine monthly mode
            if (this.frequencyMode === 'MONTHLY') {
                if (this.rruleByWeekday.length > 0 && this.rruleBySetpos.length > 0) {
                    this.monthlyMode = 'weekday';
                } else {
                    this.monthlyMode = 'day';
                }
            }

        } catch (error) {
            console.error('Error parsing rrule string:', error);
            this.resetRRuleProperties();
        }
    }

    protected generateRRuleString(): string {
        if (this.frequencyMode === 'NONE') {
            return '';
        }

        try {
            const options: Partial<import('rrule').Options> = {
                freq: this.getFrequencyConstant(),
                interval: this.rruleInterval || 1
            };

            // Add frequency-specific options
            switch (this.frequencyMode) {
                case 'WEEKLY':
                    if (this.rruleByWeekday.length > 0) {
                        options.byweekday = this.rruleByWeekday;
                    }
                    break;
                case 'MONTHLY':
                    if (this.monthlyMode === 'day' && this.rruleByMonthday.length > 0) {
                        options.bymonthday = this.rruleByMonthday;
                    } else if (this.monthlyMode === 'weekday' && this.rruleByWeekday.length > 0 && this.rruleBySetpos.length > 0) {
                        options.byweekday = this.rruleByWeekday;
                        options.bysetpos = this.rruleBySetpos;
                    }
                    break;
                case 'YEARLY':
                    if (this.rruleByMonth.length > 0) {
                        options.bymonth = this.rruleByMonth;
                    }
                    if (this.rruleByMonthday.length > 0) {
                        options.bymonthday = this.rruleByMonthday;
                    }
                    break;
            }

            // Add end conditions
            if (this.endMode === 'until' && this.rruleUntil) {
                options.until = this.rruleUntil;
            } else if (this.endMode === 'count' && this.rruleCount) {
                options.count = this.rruleCount;
            }

            const rule = new RRule(options);
            return rule.toString();
        } catch (error) {
            console.error('Error generating rrule string:', error);
            return '';
        }
    }

    private getFrequencyConstant(): Frequency {
        switch (this.frequencyMode) {
            case 'DAILY': return Frequency.DAILY;
            case 'WEEKLY': return Frequency.WEEKLY;
            case 'MONTHLY': return Frequency.MONTHLY;
            case 'YEARLY': return Frequency.YEARLY;
            default: return Frequency.DAILY;
        }
    }

    private resetRRuleProperties(): void {
        this.frequencyMode = 'NONE';
        this.rruleInterval = 1;
        this.rruleByWeekday = [];
        this.rruleByMonthday = [];
        this.rruleByMonth = [];
        this.rruleBySetpos = [];
        this.rruleUntil = null;
        this.rruleCount = null;
        this.monthlyMode = 'day';
        this.endMode = 'never';
    }

    protected getRRuleHumanText(): string {
        if (!this.recurrenceRule) {
            return 'No recurrence';
        }

        try {
            const rule = RRule.fromString(this.recurrenceRule);
            return rule.toText();
        } catch (error) {
            console.error('Error generating human text for rrule:', error);
            return 'Invalid recurrence rule';
        }
    }

    protected createFormGroup(container: HTMLElement, label: string, inputCallback: (container: HTMLElement) => void): HTMLElement {
        const formGroup = container.createDiv({ cls: 'modal-form__group' });
        const labelId = `form-label-${Math.random().toString(36).substring(2, 11)}`;
        formGroup.createEl('label', { 
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
        const inputId = `autocomplete-${fieldName}-${Math.random().toString(36).substring(2, 11)}`;
        const listboxId = `listbox-${fieldName}-${Math.random().toString(36).substring(2, 11)}`;
        
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
            setTimeout(() => this.hideSuggestions(container), 200);
        });

        input.addEventListener('keydown', (e) => {
            const suggestionsList = container.querySelector('.modal-form__suggestions') as HTMLElement;
            if (!suggestionsList) return;

            const suggestions = suggestionsList.querySelectorAll('.modal-form__suggestion');
            let selectedIndex = Array.from(suggestions).findIndex(el => el.classList.contains('modal-form__suggestion--selected'));

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
                'id': listboxId || `suggestions-${Math.random().toString(36).substring(2, 11)}`,
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
                suggestion.classList.add('modal-form__suggestion--selected');
                suggestion.setAttribute('aria-selected', 'true');
                // Update aria-activedescendant on the input
                const input = suggestion.closest('.modal-form__input-container')?.querySelector('input');
                if (input) {
                    input.setAttribute('aria-activedescendant', suggestion.id);
                }
            } else {
                suggestion.classList.remove('modal-form__suggestion--selected');
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
        const inputId = `title-input-${Math.random().toString(36).substring(2, 11)}`;
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
        const selectId = `priority-select-${Math.random().toString(36).substring(2, 11)}`;
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
        const selectId = `status-select-${Math.random().toString(36).substring(2, 11)}`;
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

        // Add help text for due date
        this.createHelpText(container, 
            'Task deadline for reference. This is separate from recurrence end dates - it appears in task info but doesn\'t control when recurring instances stop.');
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
            'When you plan to work on this task.');
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
        const inputId = `time-estimate-input-${Math.random().toString(36).substring(2, 11)}`;
        
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
        container.createDiv({ 
            cls: 'modal-form__help-text',
            text: text
        });
    }

    protected createRRuleBuilder(container: HTMLElement): void {
        // Frequency dropdown
        this.createFrequencyDropdown(container);
        
        // Interval input
        this.createIntervalInput(container);
        
        // Options container for frequency-specific settings
        const optionsContainer = container.createDiv({ cls: 'modal-form__rrule-options' });
        this.updateRRuleFrequencyOptions(optionsContainer);
        
        // End condition options
        this.createEndConditionOptions(container);
        
        // Human-readable summary
        this.createRRuleSummary(container);

        // Add help text for recurrence
        this.createHelpText(container, 
            'Create recurring instances of this task. Note: Recurring tasks will only appear in calendar views when they have a scheduled date. The scheduled date determines when the recurrence pattern starts and what time the recurring instances appear.');
    }

    private createFrequencyDropdown(container: HTMLElement): void {
        const selectId = `frequency-select-${Math.random().toString(36).substring(2, 11)}`;
        const select = container.createEl('select', { 
            cls: 'modal-form__select',
            attr: {
                'id': selectId,
                'aria-label': 'Recurrence frequency'
            }
        });

        const options = [
            { value: 'NONE', text: 'No recurrence' },
            { value: 'DAILY', text: 'Daily' },
            { value: 'WEEKLY', text: 'Weekly' },
            { value: 'MONTHLY', text: 'Monthly' },
            { value: 'YEARLY', text: 'Yearly' }
        ];

        options.forEach(option => {
            const optionEl = select.createEl('option', {
                value: option.value,
                text: option.text
            });

            if (option.value === this.frequencyMode) {
                optionEl.selected = true;
            }
        });

        select.addEventListener('change', (e) => {
            this.frequencyMode = (e.target as HTMLSelectElement).value as any;
            
            // Update interval container visibility - look in the same container, not parent
            const intervalContainer = container.querySelector('.modal-form__interval-container') as HTMLElement;
            if (intervalContainer) {
                if (this.frequencyMode === 'NONE') {
                    intervalContainer.style.display = 'none';
                } else {
                    intervalContainer.style.display = 'block';
                    // Update the interval input value and unit when frequency changes
                    const intervalInput = intervalContainer.querySelector('.modal-form__input--interval') as HTMLInputElement;
                    const unitSpan = intervalContainer.querySelector('.modal-form__interval-unit') as HTMLElement;
                    if (intervalInput) {
                        intervalInput.value = this.rruleInterval.toString();
                    }
                    if (unitSpan) {
                        this.updateIntervalUnit(unitSpan);
                    }
                }
            }
            
            // Update end condition container visibility - look in the same container, not parent
            const endContainer = container.querySelector('.modal-form__end-condition') as HTMLElement;
            if (endContainer) {
                if (this.frequencyMode === 'NONE') {
                    endContainer.style.display = 'none';
                } else {
                    endContainer.style.display = 'block';
                }
            }
            
            const optionsContainer = container.querySelector('.modal-form__rrule-options') as HTMLElement;
            if (optionsContainer) {
                this.updateRRuleFrequencyOptions(optionsContainer);
            }
            this.updateRRuleString();
        });
    }

    private createIntervalInput(container: HTMLElement): void {
        // Create interval container and always create the input elements
        const intervalContainer = container.createDiv({ cls: 'modal-form__interval-container' });
        
        // Always create the input elements, even if initially hidden
        intervalContainer.createSpan({ text: 'Every ', cls: 'modal-form__interval-label' });
        
        const input = intervalContainer.createEl('input', {
            type: 'number',
            cls: 'modal-form__input modal-form__input--interval',
            attr: { 
                min: '1', 
                max: '999',
                value: this.rruleInterval.toString()
            }
        });

        const unitSpan = intervalContainer.createSpan({ cls: 'modal-form__interval-unit' });
        this.updateIntervalUnit(unitSpan);

        input.addEventListener('input', (e) => {
            const value = parseInt((e.target as HTMLInputElement).value) || 1;
            this.rruleInterval = Math.max(1, Math.min(999, value));
            this.updateIntervalUnit(unitSpan);
            this.updateRRuleString();
        });
        
        // Hide initially if no frequency is selected
        if (this.frequencyMode === 'NONE') {
            intervalContainer.style.display = 'none';
        }
    }

    protected updateIntervalUnit(unitSpan: HTMLElement): void {
        const interval = this.rruleInterval;
        const isPlural = interval !== 1;
        
        switch (this.frequencyMode) {
            case 'DAILY':
                unitSpan.textContent = isPlural ? 'days' : 'day';
                break;
            case 'WEEKLY':
                unitSpan.textContent = isPlural ? 'weeks' : 'week';
                break;
            case 'MONTHLY':
                unitSpan.textContent = isPlural ? 'months' : 'month';
                break;
            case 'YEARLY':
                unitSpan.textContent = isPlural ? 'years' : 'year';
                break;
            default:
                unitSpan.textContent = '';
        }
    }

    protected updateRRuleFrequencyOptions(container: HTMLElement): void {
        container.empty();

        switch (this.frequencyMode) {
            case 'WEEKLY':
                this.createWeeklyOptions(container);
                break;
            case 'MONTHLY':
                this.createMonthlyOptions(container);
                break;
            case 'YEARLY':
                this.createYearlyOptions(container);
                break;
        }
    }

    private createWeeklyOptions(container: HTMLElement): void {
        container.createEl('label', { 
            text: 'On these days:', 
            cls: 'modal-form__rrule-label' 
        });

        const daysContainer = container.createDiv({ cls: 'modal-form__days-grid' });

        const days = [
            { name: 'Monday', weekday: RRule.MO },
            { name: 'Tuesday', weekday: RRule.TU },
            { name: 'Wednesday', weekday: RRule.WE },
            { name: 'Thursday', weekday: RRule.TH },
            { name: 'Friday', weekday: RRule.FR },
            { name: 'Saturday', weekday: RRule.SA },
            { name: 'Sunday', weekday: RRule.SU }
        ];

        days.forEach(day => {
            const dayContainer = daysContainer.createDiv({ cls: 'modal-form__day-checkbox' });
            const checkboxId = `day-${day.name.toLowerCase()}-${Math.random().toString(36).substring(2, 11)}`;
            
            const checkbox = dayContainer.createEl('input', {
                type: 'checkbox',
                cls: 'modal-form__day-input',
                attr: {
                    'id': checkboxId,
                    'aria-label': `Include ${day.name} in weekly recurrence`
                }
            });

            checkbox.checked = this.rruleByWeekday.some(wd => wd.weekday === day.weekday.weekday);

            dayContainer.createEl('label', { 
                text: day.name.substring(0, 3), 
                cls: 'modal-form__day-label',
                attr: { 'for': checkboxId }
            });

            checkbox.addEventListener('change', (e) => {
                if ((e.target as HTMLInputElement).checked) {
                    if (!this.rruleByWeekday.some(wd => wd.weekday === day.weekday.weekday)) {
                        this.rruleByWeekday.push(day.weekday);
                    }
                } else {
                    this.rruleByWeekday = this.rruleByWeekday.filter(wd => wd.weekday !== day.weekday.weekday);
                }
                this.updateRRuleString();
            });
        });
    }

    private createMonthlyOptions(container: HTMLElement): void {
        const modeContainer = container.createDiv({ cls: 'modal-form__monthly-mode' });
        
        // Radio buttons for monthly mode
        const dayModeId = `monthly-day-${Math.random().toString(36).substring(2, 11)}`;
        const weekdayModeId = `monthly-weekday-${Math.random().toString(36).substring(2, 11)}`;

        const dayModeContainer = modeContainer.createDiv({ cls: 'modal-form__radio-option' });
        const dayModeRadio = dayModeContainer.createEl('input', {
            type: 'radio',
            value: 'day',
            attr: { 'id': dayModeId, 'name': 'monthly-mode' }
        });
        dayModeRadio.checked = this.monthlyMode === 'day';
        
        dayModeContainer.createEl('label', { 
            text: 'On day ', 
            attr: { 'for': dayModeId }
        });

        const dayInput = dayModeContainer.createEl('input', {
            type: 'number',
            cls: 'modal-form__input modal-form__input--day',
            attr: { 
                min: '1', 
                max: '31',
                value: this.rruleByMonthday.length > 0 ? this.rruleByMonthday[0].toString() : '1'
            }
        });

        const weekdayModeContainer = modeContainer.createDiv({ cls: 'modal-form__radio-option' });
        const weekdayModeRadio = weekdayModeContainer.createEl('input', {
            type: 'radio',
            value: 'weekday',
            attr: { 'id': weekdayModeId, 'name': 'monthly-mode' }
        });
        weekdayModeRadio.checked = this.monthlyMode === 'weekday';

        weekdayModeContainer.createEl('label', { 
            text: 'On the ', 
            attr: { 'for': weekdayModeId }
        });

        const positionSelect = weekdayModeContainer.createEl('select', { cls: 'modal-form__select modal-form__select--position' });
        const positions = [
            { value: '1', text: 'first' },
            { value: '2', text: 'second' },
            { value: '3', text: 'third' },
            { value: '4', text: 'fourth' },
            { value: '-1', text: 'last' }
        ];

        positions.forEach(pos => {
            const option = positionSelect.createEl('option', {
                value: pos.value,
                text: pos.text
            });
            if (this.rruleBySetpos.length > 0 && this.rruleBySetpos[0].toString() === pos.value) {
                option.selected = true;
            }
        });

        const weekdaySelect = weekdayModeContainer.createEl('select', { cls: 'modal-form__select modal-form__select--weekday' });
        const weekdays = [
            { value: RRule.MO.weekday.toString(), text: 'Monday' },
            { value: RRule.TU.weekday.toString(), text: 'Tuesday' },
            { value: RRule.WE.weekday.toString(), text: 'Wednesday' },
            { value: RRule.TH.weekday.toString(), text: 'Thursday' },
            { value: RRule.FR.weekday.toString(), text: 'Friday' },
            { value: RRule.SA.weekday.toString(), text: 'Saturday' },
            { value: RRule.SU.weekday.toString(), text: 'Sunday' }
        ];

        weekdays.forEach(wd => {
            const option = weekdaySelect.createEl('option', {
                value: wd.value,
                text: wd.text
            });
            if (this.rruleByWeekday.length > 0 && this.rruleByWeekday[0].weekday.toString() === wd.value) {
                option.selected = true;
            }
        });

        // Event listeners
        dayModeRadio.addEventListener('change', () => {
            if (dayModeRadio.checked) {
                this.monthlyMode = 'day';
                this.rruleByMonthday = [parseInt(dayInput.value) || 1];
                this.rruleByWeekday = [];
                this.rruleBySetpos = [];
                this.updateRRuleString();
            }
        });

        weekdayModeRadio.addEventListener('change', () => {
            if (weekdayModeRadio.checked) {
                this.monthlyMode = 'weekday';
                this.rruleByMonthday = [];
                this.updateMonthlyWeekdayRule(positionSelect.value, weekdaySelect.value);
                this.updateRRuleString();
            }
        });

        dayInput.addEventListener('change', (e) => {
            if (this.monthlyMode === 'day') {
                const value = parseInt((e.target as HTMLInputElement).value) || 1;
                this.rruleByMonthday = [Math.max(1, Math.min(31, value))];
                this.updateRRuleString();
            }
        });

        positionSelect.addEventListener('change', (e) => {
            if (this.monthlyMode === 'weekday') {
                this.updateMonthlyWeekdayRule((e.target as HTMLSelectElement).value, weekdaySelect.value);
                this.updateRRuleString();
            }
        });

        weekdaySelect.addEventListener('change', (e) => {
            if (this.monthlyMode === 'weekday') {
                this.updateMonthlyWeekdayRule(positionSelect.value, (e.target as HTMLSelectElement).value);
                this.updateRRuleString();
            }
        });
    }

    private updateMonthlyWeekdayRule(position: string, weekday: string): void {
        this.rruleBySetpos = [parseInt(position)];
        const weekdayNum = parseInt(weekday);
        
        // Map weekday numbers to RRule weekday objects
        const weekdayMap: Record<number, Weekday> = {
            0: RRule.MO,
            1: RRule.TU,
            2: RRule.WE,
            3: RRule.TH,
            4: RRule.FR,
            5: RRule.SA,
            6: RRule.SU
        };
        
        if (weekdayMap[weekdayNum]) {
            this.rruleByWeekday = [weekdayMap[weekdayNum]];
        }
    }

    private createYearlyOptions(container: HTMLElement): void {
        const yearlyContainer = container.createDiv({ cls: 'modal-form__yearly-options' });
        
        yearlyContainer.createSpan({ text: 'In ', cls: 'modal-form__yearly-label' });
        
        const monthSelect = yearlyContainer.createEl('select', { cls: 'modal-form__select modal-form__select--month' });
        const months = [
            'January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December'
        ];

        months.forEach((month, index) => {
            const option = monthSelect.createEl('option', {
                value: (index + 1).toString(),
                text: month
            });
            if (this.rruleByMonth.length > 0 && this.rruleByMonth[0] === index + 1) {
                option.selected = true;
            }
        });

        yearlyContainer.createSpan({ text: ' on day ', cls: 'modal-form__yearly-label' });

        const dayInput = yearlyContainer.createEl('input', {
            type: 'number',
            cls: 'modal-form__input modal-form__input--day',
            attr: { 
                min: '1', 
                max: '31',
                value: this.rruleByMonthday.length > 0 ? this.rruleByMonthday[0].toString() : '1'
            }
        });

        monthSelect.addEventListener('change', (e) => {
            const value = parseInt((e.target as HTMLSelectElement).value);
            this.rruleByMonth = [value];
            this.updateRRuleString();
        });

        dayInput.addEventListener('change', (e) => {
            const value = parseInt((e.target as HTMLInputElement).value) || 1;
            this.rruleByMonthday = [Math.max(1, Math.min(31, value))];
            this.updateRRuleString();
        });
    }

    private createEndConditionOptions(container: HTMLElement): void {
        const endContainer = container.createDiv({ cls: 'modal-form__end-condition' });
        
        if (this.frequencyMode === 'NONE') {
            endContainer.style.display = 'none';
        }
        
        endContainer.createEl('label', { 
            text: 'Ends:', 
            cls: 'modal-form__rrule-label' 
        });

        const endOptionsContainer = endContainer.createDiv({ cls: 'modal-form__end-options' });

        // Never radio button
        const neverContainer = endOptionsContainer.createDiv({ cls: 'modal-form__radio-option' });
        const neverId = `end-never-${Math.random().toString(36).substring(2, 11)}`;
        const neverRadio = neverContainer.createEl('input', {
            type: 'radio',
            value: 'never',
            attr: { 'id': neverId, 'name': 'end-mode' }
        });
        neverRadio.checked = this.endMode === 'never';
        neverContainer.createEl('label', { 
            text: 'Never', 
            attr: { 'for': neverId }
        });

        // Until date radio button
        const untilContainer = endOptionsContainer.createDiv({ cls: 'modal-form__radio-option' });
        const untilId = `end-until-${Math.random().toString(36).substring(2, 11)}`;
        const untilRadio = untilContainer.createEl('input', {
            type: 'radio',
            value: 'until',
            attr: { 'id': untilId, 'name': 'end-mode' }
        });
        untilRadio.checked = this.endMode === 'until';
        untilContainer.createEl('label', { 
            text: 'On specific date: ', 
            attr: { 'for': untilId }
        });

        const untilDateInput = untilContainer.createEl('input', {
            type: 'date',
            cls: 'modal-form__input modal-form__input--date',
            attr: {
                value: this.rruleUntil ? this.rruleUntil.toISOString().split('T')[0] : ''
            }
        });

        // After count radio button
        const countContainer = endOptionsContainer.createDiv({ cls: 'modal-form__radio-option' });
        const countId = `end-count-${Math.random().toString(36).substring(2, 11)}`;
        const countRadio = countContainer.createEl('input', {
            type: 'radio',
            value: 'count',
            attr: { 'id': countId, 'name': 'end-mode' }
        });
        countRadio.checked = this.endMode === 'count';
        countContainer.createEl('label', { 
            text: 'After ', 
            attr: { 'for': countId }
        });

        const countInput = countContainer.createEl('input', {
            type: 'number',
            cls: 'modal-form__input modal-form__input--count',
            attr: { 
                min: '1', 
                max: '999',
                value: this.rruleCount?.toString() || '1'
            }
        });

        countContainer.createSpan({ text: ' occurrences', cls: 'modal-form__count-label' });

        // Add help text for end conditions
        this.createHelpText(endContainer, 
            'The "until date" is when recurring instances stop being generated. This is separate from the task\'s due date, which is just metadata.');

        // Event listeners
        neverRadio.addEventListener('change', () => {
            if (neverRadio.checked) {
                this.endMode = 'never';
                this.rruleUntil = null;
                this.rruleCount = null;
                this.updateRRuleString();
            }
        });

        untilRadio.addEventListener('change', () => {
            if (untilRadio.checked) {
                this.endMode = 'until';
                this.rruleCount = null;
                if (untilDateInput.value) {
                    this.rruleUntil = new Date(untilDateInput.value);
                }
                this.updateRRuleString();
            }
        });

        countRadio.addEventListener('change', () => {
            if (countRadio.checked) {
                this.endMode = 'count';
                this.rruleUntil = null;
                this.rruleCount = parseInt(countInput.value) || 1;
                this.updateRRuleString();
            }
        });

        untilDateInput.addEventListener('change', (e) => {
            if (this.endMode === 'until') {
                const value = (e.target as HTMLInputElement).value;
                this.rruleUntil = value ? new Date(value) : null;
                this.updateRRuleString();
            }
        });

        countInput.addEventListener('change', (e) => {
            if (this.endMode === 'count') {
                const value = parseInt((e.target as HTMLInputElement).value) || 1;
                this.rruleCount = Math.max(1, Math.min(999, value));
                this.updateRRuleString();
            }
        });
    }

    private createRRuleSummary(container: HTMLElement): void {
        const summaryContainer = container.createDiv({ cls: 'modal-form__rrule-summary' });
        const summary = summaryContainer.createDiv({ 
            cls: 'modal-form__rrule-text',
            text: this.getRRuleHumanText()
        });
        
        // Store reference for updating
        (container as HTMLElement & { __rruleSummary?: HTMLElement }).__rruleSummary = summary;
    }

    private updateRRuleString(): void {
        this.recurrenceRule = this.generateRRuleString();
        
        // Update summary if it exists - use modal-specific selector
        const summaryEl = this.contentEl.querySelector('.modal-form__rrule-text') as HTMLElement;
        if (summaryEl) {
            summaryEl.textContent = this.getRRuleHumanText();
        }
        
        // Update interval container if frequency changed - use modal-specific selector
        const modalContainer = this.contentEl.querySelector('.modal-form__interval-container') as HTMLElement;
        if (modalContainer) {
            const unitSpan = modalContainer.querySelector('.modal-form__interval-unit') as HTMLElement;
            if (unitSpan) {
                this.updateIntervalUnit(unitSpan);
            }
        }
    }

}