import { TAbstractFile, Setting } from 'obsidian';
import TaskNotesPlugin from '../../main';
import { DefaultReminder } from '../../types/settings';
import { 
    createSectionHeader, 
    createTextSetting, 
    createToggleSetting, 
    createDropdownSetting,
    createNumberSetting,
    createHelpText
} from '../components/settingHelpers';
import { createCard, createDeleteHeaderButton, createCardInput, createCardSelect, createCardNumberInput, showCardEmptyState } from '../components/CardComponent';
// import { ListEditorComponent, ListEditorItem } from '../components/ListEditorComponent';
import { ProjectSelectModal } from '../../modals/ProjectSelectModal';
import { splitListPreservingLinksAndQuotes } from '../../utils/stringSplit';

// interface ReminderItem extends ListEditorItem, DefaultReminder {}

/**
 * Renders the Defaults & Templates tab - settings for speeding up new task creation
 */
export function renderDefaultsTab(container: HTMLElement, plugin: TaskNotesPlugin, save: () => void): void {
    container.empty();

    // Basic Defaults Section
    createSectionHeader(container, 'Basic Defaults');
    createHelpText(container, 'Set default values for new tasks to speed up task creation.');

    createDropdownSetting(container, {
        name: 'Default status',
        desc: 'Default status for new tasks',
        options: plugin.settings.customStatuses.map(status => ({
            value: status.value,
            label: status.label || status.value
        })),
        getValue: () => plugin.settings.defaultTaskStatus,
        setValue: async (value: string) => {
            plugin.settings.defaultTaskStatus = value;
            save();
        }
    });

    createDropdownSetting(container, {
        name: 'Default priority',
        desc: 'Default priority for new tasks',
        options: [
            { value: '', label: 'No default' },
            ...plugin.settings.customPriorities.map(priority => ({
                value: priority.value,
                label: priority.label || priority.value
            }))
        ],
        getValue: () => plugin.settings.defaultTaskPriority,
        setValue: async (value: string) => {
            plugin.settings.defaultTaskPriority = value;
            save();
        }
    });

    createTextSetting(container, {
        name: 'Default contexts',
        desc: 'Comma-separated list of default contexts (e.g., @home, @work)',
        placeholder: '@home, @work',
        getValue: () => plugin.settings.taskCreationDefaults.defaultContexts,
        setValue: async (value: string) => {
            plugin.settings.taskCreationDefaults.defaultContexts = value;
            save();
        }
    });

    createTextSetting(container, {
        name: 'Default tags',
        desc: 'Comma-separated list of default tags (without #)',
        placeholder: 'important, urgent',
        getValue: () => plugin.settings.taskCreationDefaults.defaultTags,
        setValue: async (value: string) => {
            plugin.settings.taskCreationDefaults.defaultTags = value;
            save();
        }
    });

    // Default projects with file picker
    const selectedDefaultProjectFiles: TAbstractFile[] = [];
    const defaultProjectsContainer = container.createDiv('default-projects-container');
    const defaultProjectsSettingDiv = defaultProjectsContainer.createDiv();
    
    new Setting(defaultProjectsSettingDiv)
        .setName('Default projects')
        .setDesc('Default project links for new tasks')
        .addButton(button => {
            button.setButtonText('Select Projects')
                  .setTooltip('Choose project notes to link by default')
                  .onClick(() => {
                      const modal = new ProjectSelectModal(
                          plugin.app,
                          plugin,
                          (file: TAbstractFile) => {
                              // Add the selected file if not already in the list
                              if (!selectedDefaultProjectFiles.includes(file)) {
                                  selectedDefaultProjectFiles.push(file);
                                  const projectLinks = selectedDefaultProjectFiles.map(f => `[[${f.path.replace(/\.md$/, '')}]]`).join(', ');
                                  plugin.settings.taskCreationDefaults.defaultProjects = projectLinks;
                                  save();
                                  renderDefaultProjectsList(defaultProjectsContainer, plugin, save, selectedDefaultProjectFiles);
                              }
                          }
                      );
                      modal.open();
                  });
            button.buttonEl.addClass('tn-btn');
            button.buttonEl.addClass('tn-btn--ghost');
        });

    // Initialize selected projects from settings
    if (plugin.settings.taskCreationDefaults.defaultProjects) {
        const projectPaths = splitListPreservingLinksAndQuotes(plugin.settings.taskCreationDefaults.defaultProjects)
            .map(link => link.replace(/\[\[|\]\]/g, '').trim())
            .filter(path => path);
        
        projectPaths.forEach(path => {
            const file = plugin.app.vault.getAbstractFileByPath(path + '.md') || 
                        plugin.app.vault.getAbstractFileByPath(path);
            if (file) {
                selectedDefaultProjectFiles.push(file);
            }
        });
    }

    renderDefaultProjectsList(defaultProjectsContainer, plugin, save, selectedDefaultProjectFiles);

    createToggleSetting(container, {
        name: 'Use parent note as project during instant conversion',
        desc: 'Automatically link the parent note as a project when using instant task conversion',
        getValue: () => plugin.settings.taskCreationDefaults.useParentNoteAsProject,
        setValue: async (value: boolean) => {
            plugin.settings.taskCreationDefaults.useParentNoteAsProject = value;
            save();
        }
    });

    createNumberSetting(container, {
        name: 'Default time estimate',
        desc: 'Default time estimate in minutes (0 = no default)',
        placeholder: '60',
        min: 0,
        getValue: () => plugin.settings.taskCreationDefaults.defaultTimeEstimate,
        setValue: async (value: number) => {
            plugin.settings.taskCreationDefaults.defaultTimeEstimate = value;
            save();
        }
    });

    createDropdownSetting(container, {
        name: 'Default recurrence',
        desc: 'Default recurrence pattern for new tasks',
        options: [
            { value: 'none', label: 'None' },
            { value: 'daily', label: 'Daily' },
            { value: 'weekly', label: 'Weekly' },
            { value: 'monthly', label: 'Monthly' },
            { value: 'yearly', label: 'Yearly' }
        ],
        getValue: () => plugin.settings.taskCreationDefaults.defaultRecurrence,
        setValue: async (value: string) => {
            plugin.settings.taskCreationDefaults.defaultRecurrence = value as any;
            save();
        }
    });

    // Date Defaults Section
    createSectionHeader(container, 'Date Defaults');
    createHelpText(container, 'Set default due and scheduled dates for new tasks.');

    createDropdownSetting(container, {
        name: 'Default due date',
        desc: 'Default due date for new tasks',
        options: [
            { value: 'none', label: 'None' },
            { value: 'today', label: 'Today' },
            { value: 'tomorrow', label: 'Tomorrow' },
            { value: 'next-week', label: 'Next week' }
        ],
        getValue: () => plugin.settings.taskCreationDefaults.defaultDueDate,
        setValue: async (value: string) => {
            plugin.settings.taskCreationDefaults.defaultDueDate = value as any;
            save();
        }
    });

    createDropdownSetting(container, {
        name: 'Default scheduled date',
        desc: 'Default scheduled date for new tasks',
        options: [
            { value: 'none', label: 'None' },
            { value: 'today', label: 'Today' },
            { value: 'tomorrow', label: 'Tomorrow' },
            { value: 'next-week', label: 'Next week' }
        ],
        getValue: () => plugin.settings.taskCreationDefaults.defaultScheduledDate,
        setValue: async (value: string) => {
            plugin.settings.taskCreationDefaults.defaultScheduledDate = value as any;
            save();
        }
    });

    // Reminder Defaults Section
    createSectionHeader(container, 'Default Reminders');
    createHelpText(container, 'Configure default reminders that will be added to new tasks.');

    // Reminder list - using card layout
    const remindersContainer = container.createDiv('tasknotes-reminders-container');
    renderRemindersList(remindersContainer, plugin, save);
    
    // Add reminder button
    new Setting(container)
        .setName('Add default reminder')
        .setDesc('Create a new default reminder that will be added to all new tasks')
        .addButton(button => button
            .setButtonText('Add reminder')
            .onClick(async () => {
                const newId = `reminder_${Date.now()}`;
                const newReminder = {
                    id: newId,
                    type: 'relative' as const,
                    relatedTo: 'due' as const,
                    offset: 1,
                    unit: 'hours' as const,
                    direction: 'before' as const,
                    description: 'Reminder'
                };
                plugin.settings.taskCreationDefaults.defaultReminders = plugin.settings.taskCreationDefaults.defaultReminders || [];
                plugin.settings.taskCreationDefaults.defaultReminders.push(newReminder);
                save();
                renderRemindersList(remindersContainer, plugin, save);
            }));

    // Template Settings Section
    createSectionHeader(container, 'Body Template');
    createHelpText(container, 'Configure a template file to use for new task content.');

    createToggleSetting(container, {
        name: 'Use body template',
        desc: 'Use a template file for task body content',
        getValue: () => plugin.settings.taskCreationDefaults.useBodyTemplate,
        setValue: async (value: boolean) => {
            plugin.settings.taskCreationDefaults.useBodyTemplate = value;
            save();
            // Re-render to show/hide template path
            renderDefaultsTab(container, plugin, save);
        }
    });

    if (plugin.settings.taskCreationDefaults.useBodyTemplate) {
        createTextSetting(container, {
            name: 'Body template file',
            desc: 'Path to template file for task body content. Supports template variables like {{title}}, {{date}}, {{time}}, {{priority}}, {{status}}, etc.',
            placeholder: 'Templates/Task Template.md',
            getValue: () => plugin.settings.taskCreationDefaults.bodyTemplate,
            setValue: async (value: string) => {
                plugin.settings.taskCreationDefaults.bodyTemplate = value;
                save();
            },
            ariaLabel: 'Path to body template file'
        });
    }

    // Template Variables Help
    if (plugin.settings.taskCreationDefaults.useBodyTemplate) {
        const helpContainer = container.createDiv('settings-help-section');
        helpContainer.createEl('h4', { text: 'Template variables:' });
        const helpList = helpContainer.createEl('ul');
        helpList.createEl('li', { text: '{{title}} - Task title' });
        helpList.createEl('li', { text: '{{details}} - User-provided details from modal' });
        helpList.createEl('li', { text: '{{date}} - Current date (YYYY-MM-DD)' });
        helpList.createEl('li', { text: '{{time}} - Current time (HH:MM)' });
        helpList.createEl('li', { text: '{{priority}} - Task priority' });
        helpList.createEl('li', { text: '{{status}} - Task status' });
        helpList.createEl('li', { text: '{{contexts}} - Task contexts' });
        helpList.createEl('li', { text: '{{tags}} - Task tags' });
        helpList.createEl('li', { text: '{{projects}} - Task projects' });
    }

    // Instant Conversion Section
    createSectionHeader(container, 'Instant Task Conversion');
    createHelpText(container, 'Configure behavior when converting text to tasks instantly.');

    createToggleSetting(container, {
        name: 'Use task defaults on instant convert',
        desc: 'Apply default task settings when converting text to tasks instantly',
        getValue: () => plugin.settings.useDefaultsOnInstantConvert,
        setValue: async (value: boolean) => {
            plugin.settings.useDefaultsOnInstantConvert = value;
            save();
        }
    });
}

function renderDefaultProjectsList(container: HTMLElement, plugin: TaskNotesPlugin, save: () => void, selectedFiles: TAbstractFile[]): void {
    // Remove existing projects list
    const existingList = container.querySelector('.default-projects-list');
    if (existingList) {
        existingList.remove();
    }

    if (selectedFiles.length === 0) return;

    const projectsList = container.createDiv('default-projects-list');
    selectedFiles.forEach(file => {
        createCard(projectsList, {
            id: file.path,
            header: {
                primaryText: file.name.replace(/\.md$/, ''),
                actions: [
                    createDeleteHeaderButton(() => {
                        const index = selectedFiles.indexOf(file);
                        if (index > -1) {
                            selectedFiles.splice(index, 1);
                            const projectLinks = selectedFiles.map(f => `[[${f.path.replace(/\.md$/, '')}]]`).join(', ');
                            plugin.settings.taskCreationDefaults.defaultProjects = projectLinks;
                            save();
                            renderDefaultProjectsList(container, plugin, save, selectedFiles);
                        }
                    }, `Remove ${file.name} from default projects`)
                ]
            }
        });
    });
}

/* function renderReminderItem(container: HTMLElement, reminder: ReminderItem, updateItem: (updates: Partial<ReminderItem>) => void, deleteItem: () => void): void {
    // Type dropdown
    const typeSelect = container.createEl('select', {
        cls: 'settings-dropdown settings-view__dropdown',
        attr: {
            'aria-label': 'Reminder type',
            'id': `reminder-type-${reminder.id}`
        }
    });

    const typeOptions = [
        { value: 'relative', label: 'Relative' },
        { value: 'absolute', label: 'Absolute' }
    ];

    typeOptions.forEach(option => {
        const optionEl = typeSelect.createEl('option', {
            value: option.value,
            text: option.label
        });
        if (option.value === reminder.type) {
            optionEl.selected = true;
        }
    });

    typeSelect.addEventListener('change', () => {
        const newType = typeSelect.value as 'relative' | 'absolute';
        if (newType === 'relative') {
            updateItem({ 
                type: newType,
                relatedTo: 'due',
                offset: 1,
                unit: 'hours',
                direction: 'before',
                absoluteTime: undefined,
                absoluteDate: undefined
            });
        } else {
            updateItem({ 
                type: newType,
                absoluteTime: '09:00',
                absoluteDate: new Date().toISOString().split('T')[0],
                relatedTo: undefined,
                offset: undefined,
                unit: undefined,
                direction: undefined
            });
        }
    });

    // Description input
    const descInput = container.createEl('input', {
        type: 'text',
        value: reminder.description || '',
        cls: 'settings-input settings-view__input',
        attr: {
            'placeholder': 'Reminder description',
            'aria-label': 'Reminder description'
        }
    });

    descInput.addEventListener('input', () => {
        updateItem({ description: descInput.value });
    });

    // Configuration container
    const configContainer = container.createDiv('reminder-config');
    
    if (reminder.type === 'relative') {
        renderRelativeReminderConfig(configContainer, reminder, updateItem);
    } else {
        renderAbsoluteReminderConfig(configContainer, reminder, updateItem);
    }

    // Delete button
    const deleteButton = container.createEl('button', {
        text: '×',
        cls: 'settings-delete-button settings-view__delete-button',
        attr: {
            'aria-label': 'Delete reminder',
            'title': 'Delete reminder'
        }
    });

    deleteButton.addEventListener('click', () => {
        deleteItem();
    });
} */

function renderRelativeReminderConfig(container: HTMLElement, reminder: DefaultReminder, updateItem: (updates: Partial<DefaultReminder>) => void): void {
    container.empty();
    
    // Offset input
    const offsetInput = container.createEl('input', {
        type: 'number',
        value: (reminder.offset || 1).toString(),
        cls: 'settings-input settings-view__input reminder-offset',
        attr: {
            'min': '1',
            'aria-label': 'Reminder offset amount'
        }
    });

    offsetInput.addEventListener('input', () => {
        const offset = parseInt(offsetInput.value);
        if (!isNaN(offset) && offset > 0) {
            updateItem({ offset });
        }
    });

    // Unit dropdown
    const unitSelect = container.createEl('select', {
        cls: 'settings-dropdown settings-view__dropdown reminder-unit'
    });

    const unitOptions = [
        { value: 'minutes', label: 'minutes' },
        { value: 'hours', label: 'hours' },
        { value: 'days', label: 'days' }
    ];

    unitOptions.forEach(option => {
        const optionEl = unitSelect.createEl('option', {
            value: option.value,
            text: option.label
        });
        if (option.value === reminder.unit) {
            optionEl.selected = true;
        }
    });

    unitSelect.addEventListener('change', () => {
        updateItem({ unit: unitSelect.value as any });
    });

    // Direction dropdown
    const directionSelect = container.createEl('select', {
        cls: 'settings-dropdown settings-view__dropdown reminder-direction'
    });

    const directionOptions = [
        { value: 'before', label: 'before' },
        { value: 'after', label: 'after' }
    ];

    directionOptions.forEach(option => {
        const optionEl = directionSelect.createEl('option', {
            value: option.value,
            text: option.label
        });
        if (option.value === reminder.direction) {
            optionEl.selected = true;
        }
    });

    directionSelect.addEventListener('change', () => {
        updateItem({ direction: directionSelect.value as any });
    });

    // Related to dropdown
    const relatedToSelect = container.createEl('select', {
        cls: 'settings-dropdown settings-view__dropdown reminder-related-to'
    });

    const relatedToOptions = [
        { value: 'due', label: 'due date' },
        { value: 'scheduled', label: 'scheduled date' }
    ];

    relatedToOptions.forEach(option => {
        const optionEl = relatedToSelect.createEl('option', {
            value: option.value,
            text: option.label
        });
        if (option.value === reminder.relatedTo) {
            optionEl.selected = true;
        }
    });

    relatedToSelect.addEventListener('change', () => {
        updateItem({ relatedTo: relatedToSelect.value as any });
    });
}

function renderAbsoluteReminderConfig(container: HTMLElement, reminder: DefaultReminder, updateItem: (updates: Partial<DefaultReminder>) => void): void {
    container.empty();

    // Date input
    const dateInput = container.createEl('input', {
        type: 'date',
        value: reminder.absoluteDate || new Date().toISOString().split('T')[0],
        cls: 'settings-input settings-view__input reminder-date',
        attr: {
            'aria-label': 'Reminder date'
        }
    });

    dateInput.addEventListener('input', () => {
        updateItem({ absoluteDate: dateInput.value });
    });

    // Time input
    const timeInput = container.createEl('input', {
        type: 'time',
        value: reminder.absoluteTime || '09:00',
        cls: 'settings-input settings-view__input reminder-time',
        attr: {
            'aria-label': 'Reminder time'
        }
    });

    timeInput.addEventListener('input', () => {
        updateItem({ absoluteTime: timeInput.value });
    });
}

function renderRemindersList(container: HTMLElement, plugin: TaskNotesPlugin, save: () => void): void {
    container.empty();
    
    if (!plugin.settings.taskCreationDefaults.defaultReminders || plugin.settings.taskCreationDefaults.defaultReminders.length === 0) {
        const emptyState = container.createDiv('tasknotes-reminders-empty-state');
        emptyState.createSpan('tasknotes-reminders-empty-icon');
        emptyState.createSpan({
            text: 'No default reminders configured. Add a reminder to automatically notify you about new tasks.',
            cls: 'tasknotes-reminders-empty-text'
        });
        return;
    }

    plugin.settings.taskCreationDefaults.defaultReminders.forEach((reminder, index) => {
        const reminderCard = container.createDiv('tasknotes-reminder-card');
        
        // Header section with reminder info
        const reminderHeader = reminderCard.createDiv('tasknotes-reminder-header');
        
        const reminderInfo = reminderHeader.createDiv('tasknotes-reminder-info');
        
        // Primary info (reminder description)
        reminderInfo.createSpan({
            text: reminder.description || 'Unnamed Reminder',
            cls: 'tasknotes-reminder-description-text'
        });
        
        // Secondary info (timing info)
        const timingText = formatReminderTiming(reminder);
        reminderInfo.createSpan({
            text: timingText,
            cls: 'tasknotes-reminder-timing-text'
        });

        // Type indicator
        const reminderMeta = reminderHeader.createDiv('tasknotes-reminder-meta');
        reminderMeta.createSpan({
            text: reminder.type === 'relative' ? 'Relative' : 'Absolute',
            cls: 'tasknotes-reminder-type-indicator'
        });

        // Reminder configuration section
        const reminderConfig = reminderCard.createDiv('tasknotes-reminder-config');
        
        // Description input row
        const descRow = reminderConfig.createDiv('tasknotes-reminder-config-row');
        descRow.createSpan({
            text: 'Description:',
            cls: 'tasknotes-reminder-config-label'
        });
        const descInput = descRow.createEl('input', {
            type: 'text',
            value: reminder.description || '',
            cls: 'tasknotes-reminder-input',
            attr: {
                'placeholder': 'Reminder description',
                'aria-label': 'Reminder description'
            }
        });
        
        // Type selector row
        const typeRow = reminderConfig.createDiv('tasknotes-reminder-config-row');
        typeRow.createSpan({
            text: 'Type:',
            cls: 'tasknotes-reminder-config-label'
        });
        const typeSelect = typeRow.createEl('select', {
            cls: 'tasknotes-reminder-type-select',
            attr: {
                'aria-label': 'Reminder type'
            }
        });
        
        const typeOptions = [
            { value: 'relative', label: 'Relative (before/after task dates)' },
            { value: 'absolute', label: 'Absolute (specific date/time)' }
        ];
        typeOptions.forEach(option => {
            const opt = typeSelect.createEl('option', { value: option.value, text: option.label });
            if (reminder.type === option.value) opt.selected = true;
        });

        // Configuration details section (changes based on type)
        const configSection = reminderConfig.createDiv('tasknotes-reminder-config-details');
        renderReminderConfigDetails(configSection, reminder, (updates) => {
            Object.assign(reminder, updates);
            save();
            // Update timing display
            const timingElement = reminderInfo.querySelector('.tasknotes-reminder-timing-text');
            if (timingElement) {
                timingElement.textContent = formatReminderTiming(reminder);
            }
        });

        // Actions section
        const reminderActions = reminderCard.createDiv('tasknotes-reminder-actions');
        
        const deleteBtn = reminderActions.createEl('button', {
            cls: 'tasknotes-reminder-action-btn delete',
            attr: {
                'aria-label': `Delete reminder ${reminder.description}`,
                'title': 'Delete reminder'
            }
        });
        deleteBtn.createSpan({
            text: 'Delete',
            cls: 'tasknotes-reminder-action-text'
        });

        // Event listeners
        descInput.addEventListener('input', () => {
            reminder.description = descInput.value;
            reminderInfo.querySelector('.tasknotes-reminder-description-text')!.textContent = reminder.description || 'Unnamed Reminder';
            save();
        });

        typeSelect.addEventListener('change', () => {
            reminder.type = typeSelect.value as any;
            reminderMeta.querySelector('.tasknotes-reminder-type-indicator')!.textContent = 
                reminder.type === 'relative' ? 'Relative' : 'Absolute';
            
            // Re-render configuration details for new type
            renderReminderConfigDetails(configSection, reminder, (updates) => {
                Object.assign(reminder, updates);
                save();
                const timingElement = reminderInfo.querySelector('.tasknotes-reminder-timing-text');
                if (timingElement) {
                    timingElement.textContent = formatReminderTiming(reminder);
                }
            });
            save();
        });
        
        deleteBtn.addEventListener('click', () => {
            plugin.settings.taskCreationDefaults.defaultReminders = 
                plugin.settings.taskCreationDefaults.defaultReminders.filter(r => r.id !== reminder.id);
            save();
            renderRemindersList(container, plugin, save);
        });
    });
}

function formatReminderTiming(reminder: DefaultReminder): string {
    if (reminder.type === 'relative') {
        const direction = reminder.direction === 'before' ? 'before' : 'after';
        const unit = reminder.unit || 'hours';
        const offset = reminder.offset || 1;
        const relatedTo = reminder.relatedTo === 'due' ? 'due date' : 'scheduled date';
        return `${offset} ${unit} ${direction} ${relatedTo}`;
    } else {
        const date = reminder.absoluteDate || 'No date';
        const time = reminder.absoluteTime || 'No time';
        return `${date} at ${time}`;
    }
}

function renderReminderConfigDetails(container: HTMLElement, reminder: DefaultReminder, updateItem: (updates: Partial<DefaultReminder>) => void): void {
    container.empty();
    
    if (reminder.type === 'relative') {
        renderRelativeReminderConfig(container, reminder, updateItem);
    } else {
        renderAbsoluteReminderConfig(container, reminder, updateItem);
    }
}