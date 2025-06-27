import { App, Modal, Setting, setIcon } from 'obsidian';
import TaskNotesPlugin from '../main';
import { DateContextMenu } from '../components/DateContextMenu';
import { PriorityContextMenu } from '../components/PriorityContextMenu';
import { StatusContextMenu } from '../components/StatusContextMenu';
import { RecurrenceContextMenu } from '../components/RecurrenceContextMenu';
import { getDatePart, getTimePart, combineDateAndTime } from '../utils/dateUtils';

export abstract class TaskModal extends Modal {
    plugin: TaskNotesPlugin;
    
    // Core task properties
    protected title = '';
    protected details = '';
    protected dueDate = '';
    protected scheduledDate = '';
    protected priority = 'normal';
    protected status = 'open';
    protected contexts = '';
    protected tags = '';
    protected timeEstimate = 0;
    protected recurrenceRule = '';
    
    // UI elements
    protected titleInput: HTMLInputElement;
    protected detailsInput: HTMLTextAreaElement;
    protected actionBar: HTMLElement;
    protected detailsContainer: HTMLElement;
    protected isExpanded = false;

    constructor(app: App, plugin: TaskNotesPlugin) {
        super(app);
        this.plugin = plugin;
    }

    abstract initializeFormData(): Promise<void>;
    abstract handleSave(): Promise<void>;
    abstract getModalTitle(): string;

    onOpen() {
        this.containerEl.addClass('tasknotes-plugin', 'minimalist-task-modal');
        this.titleEl.textContent = this.getModalTitle();
        
        this.initializeFormData().then(() => {
            this.createModalContent();
            this.focusTitleInput();
        });
    }

    protected createModalContent(): void {
        const { contentEl } = this;
        contentEl.empty();

        // Create main container
        const container = contentEl.createDiv('minimalist-modal-container');

        // Create title input (prominent)
        this.createTitleInput(container);

        // Create action bar with icons
        this.createActionBar(container);

        // Create collapsible details section
        this.createDetailsSection(container);

        // Create save/cancel buttons
        this.createActionButtons(container);
    }

    protected createTitleInput(container: HTMLElement): void {
        const titleContainer = container.createDiv('title-input-container');
        
        this.titleInput = titleContainer.createEl('input', {
            type: 'text',
            cls: 'title-input',
            placeholder: 'What needs to be done?'
        });
        
        this.titleInput.value = this.title;
        this.titleInput.addEventListener('input', (e) => {
            this.title = (e.target as HTMLInputElement).value;
        });

        // Auto-expand on focus
        this.titleInput.addEventListener('focus', () => {
            if (!this.isExpanded) {
                this.expandModal();
            }
        });
    }

    protected createActionBar(container: HTMLElement): void {
        this.actionBar = container.createDiv('action-bar');

        // Due date icon
        this.createActionIcon(this.actionBar, 'calendar', 'Set due date', (icon, event) => {
            this.showDateContextMenu(event, 'due');
        }, 'due-date');

        // Scheduled date icon
        this.createActionIcon(this.actionBar, 'calendar-clock', 'Set scheduled date', (icon, event) => {
            this.showDateContextMenu(event, 'scheduled');
        }, 'scheduled-date');

        // Status icon
        this.createActionIcon(this.actionBar, 'dot-square', 'Set status', (icon, event) => {
            this.showStatusContextMenu(event);
        }, 'status');

        // Priority icon
        this.createActionIcon(this.actionBar, 'star', 'Set priority', (icon, event) => {
            this.showPriorityContextMenu(event);
        }, 'priority');

        // Recurrence icon
        this.createActionIcon(this.actionBar, 'refresh-ccw', 'Set recurrence', (icon, event) => {
            this.showRecurrenceContextMenu(event);
        }, 'recurrence');

        // Update icon states based on current values
        this.updateIconStates();
    }

    protected createActionIcon(
        container: HTMLElement, 
        iconName: string, 
        tooltip: string,
        onClick: (icon: HTMLElement, event: MouseEvent) => void,
        dataType?: string
    ): HTMLElement {
        const iconContainer = container.createDiv('action-icon');
        iconContainer.setAttribute('aria-label', tooltip);
        iconContainer.setAttribute('title', tooltip);
        
        // Add data attribute for easier identification
        if (dataType) {
            iconContainer.setAttribute('data-type', dataType);
        }
        
        const icon = iconContainer.createSpan('icon');
        setIcon(icon, iconName);
        
        iconContainer.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            onClick(iconContainer, event);
        });

        return iconContainer;
    }

    protected createDetailsSection(container: HTMLElement): void {
        this.detailsContainer = container.createDiv('details-container');
        if (!this.isExpanded) {
            this.detailsContainer.style.display = 'none';
        }

        // Title field (appears on expansion)
        const titleLabel = this.detailsContainer.createDiv('detail-label');
        titleLabel.textContent = 'Title';
        
        this.titleInput = this.detailsContainer.createEl('input', {
            type: 'text',
            cls: 'title-input-detailed',
            placeholder: 'Task title...'
        });
        
        this.titleInput.value = this.title;
        this.titleInput.addEventListener('input', (e) => {
            this.title = (e.target as HTMLInputElement).value;
        });

        // Details textarea (only for creation modals, not edit modals)
        if (this.getModalTitle() !== 'Edit task') {
            const detailsLabel = this.detailsContainer.createDiv('detail-label');
            detailsLabel.textContent = 'Details';
            
            this.detailsInput = this.detailsContainer.createEl('textarea', {
                cls: 'details-input',
                placeholder: 'Add more details...'
            });
            
            this.detailsInput.value = this.details;
            this.detailsInput.addEventListener('input', (e) => {
                this.details = (e.target as HTMLTextAreaElement).value;
            });
        }

        // Additional form fields (contexts, tags, etc.) can be added here
        this.createAdditionalFields(this.detailsContainer);
    }

    protected createAdditionalFields(container: HTMLElement): void {
        // Contexts input with autocomplete
        new Setting(container)
            .setName('Contexts')
            .addText(text => {
                text.setPlaceholder('context1, context2')
                    .setValue(this.contexts)
                    .onChange(value => {
                        this.contexts = value;
                    });
                
                // Add autocomplete functionality
                this.setupAutocomplete(text.inputEl, 'contexts');
            });

        // Tags input with autocomplete
        new Setting(container)
            .setName('Tags')
            .addText(text => {
                text.setPlaceholder('tag1, tag2')
                    .setValue(this.tags)
                    .onChange(value => {
                        this.tags = value;
                    });
                
                // Add autocomplete functionality
                this.setupAutocomplete(text.inputEl, 'tags');
            });

        // Time estimate
        new Setting(container)
            .setName('Time estimate (minutes)')
            .addText(text => {
                text.setPlaceholder('30')
                    .setValue(this.timeEstimate.toString())
                    .onChange(value => {
                        this.timeEstimate = parseInt(value) || 0;
                    });
            });
    }

    private setupAutocomplete(inputEl: HTMLInputElement, type: 'contexts' | 'tags'): void {
        let currentSuggestions: string[] = [];
        let suggestionContainer: HTMLElement | null = null;
        let selectedIndex = -1;

        const showSuggestions = async (query: string) => {
            if (!query) {
                hideSuggestions();
                return;
            }

            // Get existing items based on type
            const existingItems = type === 'contexts' 
                ? await this.plugin.cacheManager.getAllContexts()
                : await this.plugin.cacheManager.getAllTags();

            // Filter suggestions based on current input
            const currentValues = inputEl.value.split(',').map(v => v.trim());
            const currentQuery = currentValues[currentValues.length - 1];
            
            if (!currentQuery) {
                hideSuggestions();
                return;
            }

            currentSuggestions = existingItems
                .filter(item => 
                    item.toLowerCase().includes(currentQuery.toLowerCase()) &&
                    !currentValues.slice(0, -1).includes(item)
                )
                .slice(0, 10);

            if (currentSuggestions.length === 0) {
                hideSuggestions();
                return;
            }

            // Create suggestion container
            if (!suggestionContainer) {
                // Make the input's parent container relative to position suggestions correctly
                const parentContainer = inputEl.closest('.setting-item-control') as HTMLElement;
                if (parentContainer) {
                    parentContainer.style.position = 'relative';
                }
                
                suggestionContainer = inputEl.parentElement!.createDiv('autocomplete-suggestions');
                suggestionContainer.style.position = 'absolute';
                suggestionContainer.style.top = '100%';
                suggestionContainer.style.left = '0';
                suggestionContainer.style.right = '0';
                suggestionContainer.style.backgroundColor = 'var(--background-primary)';
                suggestionContainer.style.border = '1px solid var(--background-modifier-border)';
                suggestionContainer.style.borderTop = 'none';
                suggestionContainer.style.borderRadius = '0 0 var(--radius-s) var(--radius-s)';
                suggestionContainer.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.1)';
                suggestionContainer.style.zIndex = '1000';
                suggestionContainer.style.maxHeight = '200px';
                suggestionContainer.style.overflowY = 'auto';
            }

            suggestionContainer.empty();
            selectedIndex = -1;

            currentSuggestions.forEach((suggestion, index) => {
                const suggestionEl = suggestionContainer!.createDiv('autocomplete-suggestion');
                suggestionEl.textContent = suggestion;
                suggestionEl.style.padding = '8px 12px';
                suggestionEl.style.cursor = 'pointer';
                suggestionEl.style.borderBottom = '1px solid var(--background-modifier-border-hover)';
                suggestionEl.style.fontSize = 'var(--font-ui-small)';

                suggestionEl.addEventListener('click', () => {
                    selectSuggestion(suggestion);
                });

                suggestionEl.addEventListener('mouseenter', () => {
                    selectedIndex = index;
                    updateSelectedSuggestion();
                });
            });
        };

        const hideSuggestions = () => {
            if (suggestionContainer) {
                suggestionContainer.remove();
                suggestionContainer = null;
            }
            selectedIndex = -1;
        };

        const selectSuggestion = (suggestion: string) => {
            const currentValues = inputEl.value.split(',').map(v => v.trim());
            currentValues[currentValues.length - 1] = suggestion;
            inputEl.value = currentValues.join(', ') + ', ';
            
            if (type === 'contexts') {
                this.contexts = inputEl.value.trim();
            } else {
                this.tags = inputEl.value.trim();
            }
            
            hideSuggestions();
            inputEl.focus();
        };

        const updateSelectedSuggestion = () => {
            if (!suggestionContainer) return;
            
            const suggestions = suggestionContainer.querySelectorAll('.autocomplete-suggestion');
            suggestions.forEach((el, index) => {
                if (index === selectedIndex) {
                    (el as HTMLElement).style.backgroundColor = 'var(--background-modifier-hover)';
                } else {
                    (el as HTMLElement).style.backgroundColor = 'transparent';
                }
            });
        };

        // Event listeners
        inputEl.addEventListener('input', (e) => {
            const target = e.target as HTMLInputElement;
            showSuggestions(target.value);
        });

        inputEl.addEventListener('keydown', (e) => {
            if (!suggestionContainer || currentSuggestions.length === 0) return;

            switch (e.key) {
                case 'ArrowDown':
                    e.preventDefault();
                    selectedIndex = Math.min(selectedIndex + 1, currentSuggestions.length - 1);
                    updateSelectedSuggestion();
                    break;
                case 'ArrowUp':
                    e.preventDefault();
                    selectedIndex = Math.max(selectedIndex - 1, -1);
                    updateSelectedSuggestion();
                    break;
                case 'Enter':
                    if (selectedIndex >= 0) {
                        e.preventDefault();
                        selectSuggestion(currentSuggestions[selectedIndex]);
                    }
                    break;
                case 'Escape':
                    hideSuggestions();
                    break;
            }
        });

        inputEl.addEventListener('blur', () => {
            // Delay hiding to allow clicking on suggestions
            setTimeout(() => hideSuggestions(), 200);
        });
    }

    protected createActionButtons(container: HTMLElement): void {
        const buttonContainer = container.createDiv('button-container');

        // Add "Open note" button for edit modals only
        if (this.getModalTitle() === 'Edit task') {
            const openNoteButton = buttonContainer.createEl('button', {
                cls: 'open-note-button',
                text: 'Open note'
            });
            
            openNoteButton.addEventListener('click', async () => {
                await (this as any).openTaskNote();
            });

            // Spacer to push Save/Cancel to the right
            buttonContainer.createDiv('button-spacer');
        }

        // Save button
        const saveButton = buttonContainer.createEl('button', {
            cls: 'save-button',
            text: 'Save'
        });
        
        saveButton.addEventListener('click', async () => {
            await this.handleSave();
            this.close();
        });

        // Cancel button
        const cancelButton = buttonContainer.createEl('button', {
            cls: 'cancel-button',
            text: 'Cancel'
        });
        
        cancelButton.addEventListener('click', () => {
            this.close();
        });
    }

    protected expandModal(): void {
        if (this.isExpanded) return;
        
        this.isExpanded = true;
        this.detailsContainer.style.display = 'block';
        this.containerEl.addClass('expanded');
        
        // Animate the expansion
        this.detailsContainer.style.opacity = '0';
        this.detailsContainer.style.transform = 'translateY(-10px)';
        
        setTimeout(() => {
            this.detailsContainer.style.opacity = '1';
            this.detailsContainer.style.transform = 'translateY(0)';
        }, 50);
    }

    protected showDateContextMenu(event: MouseEvent, type: 'due' | 'scheduled'): void {
        const currentValue = type === 'due' ? this.dueDate : this.scheduledDate;
        
        const menu = new DateContextMenu({
            currentValue: currentValue ? getDatePart(currentValue) : undefined,
            currentTime: currentValue ? getTimePart(currentValue) : undefined,
            onSelect: (value: string | null, time: string | null) => {
                if (value) {
                    // Combine date and time if both are provided
                    const finalValue = time ? combineDateAndTime(value, time) : value;
                    
                    if (type === 'due') {
                        this.dueDate = finalValue;
                    } else {
                        this.scheduledDate = finalValue;
                    }
                } else {
                    // Clear the date
                    if (type === 'due') {
                        this.dueDate = '';
                    } else {
                        this.scheduledDate = '';
                    }
                }
                this.updateDateIconState();
            }
        });
        
        menu.show(event);
    }

    protected showStatusContextMenu(event: MouseEvent): void {
        const menu = new StatusContextMenu({
            currentValue: this.status,
            onSelect: (value) => {
                this.status = value;
                this.updateStatusIconState();
            },
            plugin: this.plugin
        });
        
        menu.show(event);
    }

    protected showPriorityContextMenu(event: MouseEvent): void {
        const menu = new PriorityContextMenu({
            currentValue: this.priority,
            onSelect: (value) => {
                this.priority = value;
                this.updatePriorityIconState();
            },
            plugin: this.plugin
        });
        
        menu.show(event);
    }

    protected showRecurrenceContextMenu(event: MouseEvent): void {
        const menu = new RecurrenceContextMenu({
            currentValue: this.recurrenceRule,
            onSelect: (value) => {
                this.recurrenceRule = value || '';
                this.updateRecurrenceIconState();
            },
            app: this.app
        });
        
        menu.show(event);
    }

    protected updateDateIconState(): void {
        this.updateIconStates();
    }

    protected updateStatusIconState(): void {
        this.updateIconStates();
    }

    protected updatePriorityIconState(): void {
        this.updateIconStates();
    }

    protected updateRecurrenceIconState(): void {
        this.updateIconStates();
    }


    protected getDefaultStatus(): string {
        // Get the first status (lowest order) as default
        const statusConfigs = this.plugin.settings.customStatuses;
        if (statusConfigs && statusConfigs.length > 0) {
            const sortedStatuses = [...statusConfigs].sort((a, b) => a.order - b.order);
            return sortedStatuses[0].value;
        }
        return 'open'; // fallback
    }

    protected getDefaultPriority(): string {
        // Get the priority with lowest weight as default
        const priorityConfigs = this.plugin.settings.customPriorities;
        if (priorityConfigs && priorityConfigs.length > 0) {
            const sortedPriorities = [...priorityConfigs].sort((a, b) => a.weight - b.weight);
            return sortedPriorities[0].value;
        }
        return 'normal'; // fallback
    }

    protected getRecurrenceDisplayText(): string {
        if (!this.recurrenceRule) return '';
        
        // Parse RRULE patterns into human-readable text
        const rule = this.recurrenceRule;
        
        if (rule.includes('FREQ=DAILY')) {
            return 'Daily';
        } else if (rule.includes('FREQ=WEEKLY')) {
            if (rule.includes('INTERVAL=2')) {
                return 'Every 2 weeks';
            } else if (rule.includes('BYDAY=MO,TU,WE,TH,FR')) {
                return 'Weekdays';
            } else if (rule.includes('BYDAY=')) {
                // Extract day for display
                const dayMatch = rule.match(/BYDAY=([A-Z]{2})/);
                if (dayMatch) {
                    const dayMap: Record<string, string> = {
                        'SU': 'Sunday', 'MO': 'Monday', 'TU': 'Tuesday', 
                        'WE': 'Wednesday', 'TH': 'Thursday', 'FR': 'Friday', 'SA': 'Saturday'
                    };
                    return `Weekly on ${dayMap[dayMatch[1]] || dayMatch[1]}`;
                }
                return 'Weekly';
            } else {
                return 'Weekly';
            }
        } else if (rule.includes('FREQ=MONTHLY')) {
            if (rule.includes('INTERVAL=3')) {
                return 'Every 3 months';
            } else if (rule.includes('BYMONTHDAY=')) {
                const dayMatch = rule.match(/BYMONTHDAY=(\d+)/);
                if (dayMatch) {
                    return `Monthly on the ${this.getOrdinal(parseInt(dayMatch[1]))}`;
                }
                return 'Monthly';
            } else if (rule.includes('BYDAY=')) {
                return 'Monthly (by weekday)';
            } else {
                return 'Monthly';
            }
        } else if (rule.includes('FREQ=YEARLY')) {
            if (rule.includes('BYMONTH=') && rule.includes('BYMONTHDAY=')) {
                const monthMatch = rule.match(/BYMONTH=(\d+)/);
                const dayMatch = rule.match(/BYMONTHDAY=(\d+)/);
                if (monthMatch && dayMatch) {
                    const monthNames = ['', 'January', 'February', 'March', 'April', 'May', 'June', 
                                      'July', 'August', 'September', 'October', 'November', 'December'];
                    const month = monthNames[parseInt(monthMatch[1])];
                    const day = this.getOrdinal(parseInt(dayMatch[1]));
                    return `Yearly on ${month} ${day}`;
                }
            }
            return 'Yearly';
        }
        
        // Check for end conditions
        let endText = '';
        if (rule.includes('COUNT=')) {
            const countMatch = rule.match(/COUNT=(\d+)/);
            if (countMatch) {
                endText = ` (${countMatch[1]} times)`;
            }
        } else if (rule.includes('UNTIL=')) {
            const untilMatch = rule.match(/UNTIL=(\d{8})/);
            if (untilMatch) {
                const date = untilMatch[1];
                const formatted = `${date.slice(0,4)}-${date.slice(4,6)}-${date.slice(6,8)}`;
                endText = ` (until ${formatted})`;
            }
        }
        
        // Fallback for custom patterns
        return 'Custom' + endText;
    }

    private getOrdinal(n: number): string {
        const s = ['th', 'st', 'nd', 'rd'];
        const v = n % 100;
        return n + (s[(v - 20) % 10] || s[v] || s[0]);
    }

    protected updateIconStates(): void {
        if (!this.actionBar) return;

        // Update due date icon
        const dueDateIcon = this.actionBar.querySelector('[data-type="due-date"]') as HTMLElement;
        if (dueDateIcon && this.dueDate) {
            dueDateIcon.classList.add('has-value');
            dueDateIcon.setAttribute('title', `Due: ${this.dueDate}`);
        } else if (dueDateIcon) {
            dueDateIcon.classList.remove('has-value');
            dueDateIcon.setAttribute('title', 'Set due date');
        }

        // Update scheduled date icon
        const scheduledDateIcon = this.actionBar.querySelector('[data-type="scheduled-date"]') as HTMLElement;
        if (scheduledDateIcon && this.scheduledDate) {
            scheduledDateIcon.classList.add('has-value');
            scheduledDateIcon.setAttribute('title', `Scheduled: ${this.scheduledDate}`);
        } else if (scheduledDateIcon) {
            scheduledDateIcon.classList.remove('has-value');
            scheduledDateIcon.setAttribute('title', 'Set scheduled date');
        }

        // Update status icon
        const statusIcon = this.actionBar.querySelector('[data-type="status"]') as HTMLElement;
        if (statusIcon) {
            // Find the status config to get the label and color
            const statusConfig = this.plugin.settings.customStatuses.find(s => s.value === this.status);
            const statusLabel = statusConfig ? statusConfig.label : this.status;
            
            if (this.status && statusConfig && statusConfig.value !== this.getDefaultStatus()) {
                statusIcon.classList.add('has-value');
                statusIcon.setAttribute('title', `Status: ${statusLabel}`);
            } else {
                statusIcon.classList.remove('has-value');
                statusIcon.setAttribute('title', 'Set status');
            }

            // Apply status color to the icon
            const iconEl = statusIcon.querySelector('.icon') as HTMLElement;
            if (iconEl && statusConfig && statusConfig.color) {
                iconEl.style.color = statusConfig.color;
            } else if (iconEl) {
                iconEl.style.color = ''; // Reset to default
            }
        }

        // Update priority icon
        const priorityIcon = this.actionBar.querySelector('[data-type="priority"]') as HTMLElement;
        if (priorityIcon) {
            // Find the priority config to get the label and color
            const priorityConfig = this.plugin.settings.customPriorities.find(p => p.value === this.priority);
            const priorityLabel = priorityConfig ? priorityConfig.label : this.priority;
            
            if (this.priority && priorityConfig && priorityConfig.value !== this.getDefaultPriority()) {
                priorityIcon.classList.add('has-value');
                priorityIcon.setAttribute('title', `Priority: ${priorityLabel}`);
            } else {
                priorityIcon.classList.remove('has-value');
                priorityIcon.setAttribute('title', 'Set priority');
            }

            // Apply priority color to the icon
            const iconEl = priorityIcon.querySelector('.icon') as HTMLElement;
            if (iconEl && priorityConfig && priorityConfig.color) {
                iconEl.style.color = priorityConfig.color;
            } else if (iconEl) {
                iconEl.style.color = ''; // Reset to default
            }
        }

        // Update recurrence icon
        const recurrenceIcon = this.actionBar.querySelector('[data-type="recurrence"]') as HTMLElement;
        if (recurrenceIcon) {
            if (this.recurrenceRule && this.recurrenceRule.trim()) {
                recurrenceIcon.classList.add('has-value');
                recurrenceIcon.setAttribute('title', `Recurrence: ${this.getRecurrenceDisplayText()}`);
            } else {
                recurrenceIcon.classList.remove('has-value');
                recurrenceIcon.setAttribute('title', 'Set recurrence');
            }
        }
    }

    protected focusTitleInput(): void {
        setTimeout(() => {
            this.titleInput.focus();
            this.titleInput.select();
        }, 100);
    }

    protected validateForm(): boolean {
        return this.title.trim().length > 0;
    }
}
