import { Menu } from 'obsidian';

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
        // Create a simple date & time picker modal
        const modal = document.createElement('div');
        modal.className = 'date-picker-modal';
        modal.style.position = 'fixed';
        modal.style.top = '50%';
        modal.style.left = '50%';
        modal.style.transform = 'translate(-50%, -50%)';
        modal.style.background = 'var(--background-primary)';
        modal.style.border = '1px solid var(--background-modifier-border)';
        modal.style.borderRadius = 'var(--radius-m)';
        modal.style.padding = 'var(--size-4-4)';
        modal.style.boxShadow = 'var(--shadow-l)';
        modal.style.zIndex = '1000';
        modal.style.minWidth = '320px';

        // Create title
        const title = document.createElement('h3');
        title.textContent = 'Set Date & Time';
        title.style.margin = '0 0 var(--size-4-3) 0';
        title.style.fontSize = 'var(--font-ui-medium)';
        title.style.fontWeight = '600';

        // Create date input
        const dateLabel = document.createElement('label');
        dateLabel.textContent = 'Date:';
        dateLabel.style.display = 'block';
        dateLabel.style.marginBottom = 'var(--size-4-1)';
        dateLabel.style.fontSize = 'var(--font-ui-small)';
        dateLabel.style.fontWeight = '500';
        dateLabel.style.color = 'var(--text-muted)';

        const dateInput = document.createElement('input');
        dateInput.type = 'date';
        dateInput.style.width = '100%';
        dateInput.style.padding = 'var(--size-4-2)';
        dateInput.style.border = '1px solid var(--background-modifier-border)';
        dateInput.style.borderRadius = 'var(--radius-s)';
        dateInput.style.marginBottom = 'var(--size-4-3)';
        
        // Set current value if available
        if (this.options.currentValue && this.options.currentValue.trim()) {
            dateInput.value = this.options.currentValue;
        }

        // Create time input
        const timeLabel = document.createElement('label');
        timeLabel.textContent = 'Time (optional):';
        timeLabel.style.display = 'block';
        timeLabel.style.marginBottom = 'var(--size-4-1)';
        timeLabel.style.fontSize = 'var(--font-ui-small)';
        timeLabel.style.fontWeight = '500';
        timeLabel.style.color = 'var(--text-muted)';

        const timeInput = document.createElement('input');
        timeInput.type = 'time';
        timeInput.style.width = '100%';
        timeInput.style.padding = 'var(--size-4-2)';
        timeInput.style.border = '1px solid var(--background-modifier-border)';
        timeInput.style.borderRadius = 'var(--radius-s)';
        timeInput.style.marginBottom = 'var(--size-4-3)';

        // Set current time if available
        if (this.options.currentTime && this.options.currentTime.trim()) {
            timeInput.value = this.options.currentTime;
        }

        // Create buttons container
        const buttonsContainer = document.createElement('div');
        buttonsContainer.style.display = 'flex';
        buttonsContainer.style.gap = 'var(--size-4-2)';
        buttonsContainer.style.justifyContent = 'flex-end';

        // Create buttons
        const selectButton = document.createElement('button');
        selectButton.textContent = 'Select';
        selectButton.style.padding = 'var(--size-4-1) var(--size-4-3)';
        selectButton.style.background = 'var(--interactive-accent)';
        selectButton.style.color = 'var(--text-on-accent)';
        selectButton.style.border = 'none';
        selectButton.style.borderRadius = 'var(--radius-s)';
        selectButton.style.cursor = 'pointer';

        const cancelButton = document.createElement('button');
        cancelButton.textContent = 'Cancel';
        cancelButton.style.padding = 'var(--size-4-1) var(--size-4-3)';
        cancelButton.style.background = 'var(--background-secondary)';
        cancelButton.style.color = 'var(--text-normal)';
        cancelButton.style.border = '1px solid var(--background-modifier-border)';
        cancelButton.style.borderRadius = 'var(--radius-s)';
        cancelButton.style.cursor = 'pointer';

        // Add event listeners
        selectButton.addEventListener('click', () => {
            if (dateInput.value) {
                this.options.onSelect(dateInput.value, timeInput.value || null);
            }
            document.body.removeChild(modal);
        });

        cancelButton.addEventListener('click', () => {
            document.body.removeChild(modal);
        });

        // Handle escape key
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                document.body.removeChild(modal);
                document.removeEventListener('keydown', handleEscape);
            }
        };
        document.addEventListener('keydown', handleEscape);

        // Handle Enter key in inputs
        const handleEnter = (e: KeyboardEvent) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                selectButton.click();
            }
        };
        
        dateInput.addEventListener('keydown', handleEnter);
        timeInput.addEventListener('keydown', handleEnter);

        // Assemble modal
        buttonsContainer.appendChild(cancelButton);
        buttonsContainer.appendChild(selectButton);
        
        modal.appendChild(title);
        modal.appendChild(dateLabel);
        modal.appendChild(dateInput);
        modal.appendChild(timeLabel);
        modal.appendChild(timeInput);
        modal.appendChild(buttonsContainer);
        
        document.body.appendChild(modal);

        // Focus the date input
        setTimeout(() => {
            dateInput.focus();
        }, 100);
    }
}