import { Menu, setIcon } from 'obsidian';

export interface DateOption {
    label: string;
    value: string | null;
    icon?: string;
    isToday?: boolean;
    isCustom?: boolean;
}

export interface DateContextMenuOptions {
    currentValue?: string | null;
    currentTime?: string | null;
    onSelect: (value: string | null, time?: string | null) => void;
    onCustomDate?: () => void;
    includeScheduled?: boolean;
    includeDue?: boolean;
    showRelativeDates?: boolean;
    title?: string;
}

export class DateContextMenu {
    private menu: Menu;
    private options: DateContextMenuOptions;

    constructor(options: DateContextMenuOptions) {
        this.menu = new Menu();
        this.options = options;
        this.buildMenu();
    }

    private buildMenu(): void {
        // Add title if provided
        if (this.options.title) {
            this.menu.addItem(item => {
                item.setTitle(this.options.title!);
                item.setIcon('calendar');
                item.setDisabled(true);
            });
            this.menu.addSeparator();
        }
        
        const dateOptions = this.getDateOptions();
        
        // Add quick date options
        dateOptions.forEach(option => {
            this.menu.addItem(item => {
                let title = option.label;
                if (option.icon) {
                    item.setIcon(option.icon);
                }
                
                // Highlight current selection with visual indicator
                if (option.value && option.value === this.options.currentValue) {
                    title = `✓ ${option.label}`;
                }
                
                item.setTitle(title);
                
                item.onClick(async () => {
                    this.options.onSelect(option.value, null);
                });
            });
        });

        // Add separator before custom options
        this.menu.addSeparator();

        // Add custom date picker option
        this.menu.addItem(item => {
            item.setTitle('Pick date & time...');
            item.setIcon('calendar');
            item.onClick(async () => {
                this.showDateTimePicker();
            });
        });

        // Add clear option if there's a current value
        if (this.options.currentValue) {
            this.menu.addItem(item => {
                item.setTitle('Clear date');
                item.setIcon('x');
                item.onClick(async () => {
                    this.options.onSelect(null, null);
                });
            });
        }
    }

    private getDateOptions(): DateOption[] {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const today = (window as any).moment();
        const options: DateOption[] = [];

        // Today option
        options.push({
            label: 'Today',
            value: today.format('YYYY-MM-DD'),
            icon: 'calendar-check',
            isToday: true
        });

        // Tomorrow option
        options.push({
            label: 'Tomorrow',
            value: today.clone().add(1, 'day').format('YYYY-MM-DD'),
            icon: 'calendar-plus'
        });

        // This weekend (Saturday)
        const nextSaturday = today.clone().day(6);
        if (nextSaturday.isBefore(today) || nextSaturday.isSame(today, 'day')) {
            nextSaturday.add(1, 'week');
        }
        options.push({
            label: 'This weekend',
            value: nextSaturday.format('YYYY-MM-DD'),
            icon: 'calendar-days'
        });

        // Next week (Monday)
        const nextMonday = today.clone().day(1).add(1, 'week');
        options.push({
            label: 'Next week',
            value: nextMonday.format('YYYY-MM-DD'),
            icon: 'calendar-plus'
        });

        // Next month
        const nextMonth = today.clone().add(1, 'month').startOf('month');
        options.push({
            label: 'Next month',
            value: nextMonth.format('YYYY-MM-DD'),
            icon: 'calendar-range'
        });

        return options;
    }

    public show(event: MouseEvent): void {
        this.menu.showAtMouseEvent(event);
    }

    public showAtElement(element: HTMLElement): void {
        this.menu.showAtPosition({
            x: element.getBoundingClientRect().left,
            y: element.getBoundingClientRect().bottom + 4
        });
    }

    private showDateTimePicker(): void {
        const modal = this.createModal();
        
        // Create title with icon
        const header = this.createHeader();
        
        // Create date input section
        const dateSection = this.createDateSection();
        
        // Create time input section
        const timeSection = this.createTimeSection();
        
        // Create action buttons
        const buttonSection = this.createButtonSection();
        
        // Assemble modal
        modal.appendChild(header);
        modal.appendChild(dateSection.container);
        modal.appendChild(timeSection.container);
        modal.appendChild(buttonSection.container);
        
        document.body.appendChild(modal);
        
        // Set up event handlers
        this.setupModalEventHandlers(modal, dateSection.input, timeSection.input, buttonSection.selectButton);
        
        // Focus the date input
        setTimeout(() => {
            dateSection.input.focus();
        }, 100);
    }

    private createModal(): HTMLElement {
        const modal = document.createElement('div');
        modal.className = 'date-picker-modal';
        return modal;
    }

    private createHeader(): HTMLElement {
        const header = document.createElement('div');
        header.className = 'date-picker-modal__header';

        // Calendar icon
        const icon = document.createElement('div');
        icon.className = 'date-picker-modal__header-icon';
        setIcon(icon, 'calendar');

        const title = document.createElement('h3');
        title.className = 'date-picker-modal__header-title';
        title.textContent = 'Set date & time';

        header.appendChild(icon);
        header.appendChild(title);
        return header;
    }

    private createDateSection(): { container: HTMLElement; input: HTMLInputElement } {
        const container = document.createElement('div');
        container.className = 'date-picker-modal__section';

        const label = this.createInputLabel('calendar', 'Date');
        const inputContainer = this.createInputContainer();
        const input = this.createDateInput();

        if (this.options.currentValue?.trim()) {
            input.value = this.options.currentValue;
        }

        inputContainer.appendChild(input);
        container.appendChild(label);
        container.appendChild(inputContainer);

        return { container, input };
    }

    private createTimeSection(): { container: HTMLElement; input: HTMLInputElement } {
        const container = document.createElement('div');
        container.className = 'date-picker-modal__section date-picker-modal__section--buttons';

        const label = this.createInputLabel('clock', 'Time (optional)');
        const inputContainer = this.createInputContainer();
        const input = this.createTimeInput();

        if (this.options.currentTime?.trim()) {
            input.value = this.options.currentTime;
        }

        inputContainer.appendChild(input);
        container.appendChild(label);
        container.appendChild(inputContainer);

        return { container, input };
    }

    private createInputLabel(iconName: string, text: string): HTMLElement {
        const label = document.createElement('label');
        label.className = 'date-picker-modal__label';

        const icon = document.createElement('div');
        icon.className = 'date-picker-modal__label-icon';
        setIcon(icon, iconName === 'calendar' ? 'calendar' : 'clock');

        const labelText = document.createElement('span');
        labelText.textContent = text;

        label.appendChild(icon);
        label.appendChild(labelText);
        return label;
    }

    private createInputContainer(): HTMLElement {
        const container = document.createElement('div');
        container.className = 'date-picker-modal__input-container';
        return container;
    }

    private createDateInput(): HTMLInputElement {
        const input = document.createElement('input');
        input.type = 'date';
        input.className = 'date-picker-modal__input';
        this.addPickerClickHandler(input);
        return input;
    }

    private createTimeInput(): HTMLInputElement {
        const input = document.createElement('input');
        input.type = 'time';
        input.className = 'date-picker-modal__input';
        this.addPickerClickHandler(input);
        return input;
    }


    private addPickerClickHandler(input: HTMLInputElement): void {
        input.addEventListener('click', () => {
            try {
                if ('showPicker' in input && typeof (input as any).showPicker === 'function') {
                    (input as any).showPicker();
                } else {
                    input.focus();
                }
            } catch (error: any) {
                input.focus();
            }
        });
    }

    private createButtonSection(): { container: HTMLElement; selectButton: HTMLButtonElement } {
        const container = document.createElement('div');
        container.className = 'date-picker-modal__buttons';

        const cancelButton = this.createButton('Cancel', false);
        const selectButton = this.createButton('Select', true);

        container.appendChild(cancelButton);
        container.appendChild(selectButton);

        return { container, selectButton };
    }

    private createButton(text: string, isPrimary: boolean): HTMLButtonElement {
        const button = document.createElement('button');
        button.textContent = text;
        button.className = isPrimary 
            ? 'date-picker-modal__button date-picker-modal__button--primary'
            : 'date-picker-modal__button date-picker-modal__button--secondary';
        return button;
    }

    private setupModalEventHandlers(
        modal: HTMLElement, 
        dateInput: HTMLInputElement, 
        timeInput: HTMLInputElement, 
        selectButton: HTMLButtonElement
    ): void {
        // Select button click
        selectButton.addEventListener('click', () => {
            if (dateInput.value) {
                this.options.onSelect(dateInput.value, timeInput.value || null);
            }
            document.body.removeChild(modal);
        });

        // Cancel button click
        const cancelButton = modal.querySelector('.date-picker-modal__button--secondary') as HTMLButtonElement;
        cancelButton.addEventListener('click', () => {
            document.body.removeChild(modal);
        });

        // Escape key
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                document.body.removeChild(modal);
                document.removeEventListener('keydown', handleEscape);
            }
        };
        document.addEventListener('keydown', handleEscape);

        // Enter key in inputs
        const handleEnter = (e: KeyboardEvent) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                selectButton.click();
            }
        };
        
        dateInput.addEventListener('keydown', handleEnter);
        timeInput.addEventListener('keydown', handleEnter);

        // Click outside to close
        const handleClickOutside = (e: MouseEvent) => {
            if (!modal.contains(e.target as Node)) {
                document.body.removeChild(modal);
                document.removeEventListener('click', handleClickOutside);
                document.removeEventListener('keydown', handleEscape);
            }
        };
        
        // Add slight delay to prevent immediate closure
        setTimeout(() => {
            document.addEventListener('click', handleClickOutside);
        }, 100);
    }
}
