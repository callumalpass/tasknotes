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
import { createCard, createDeleteHeaderButton, createCardInput, createCardSelect, createCardNumberInput, showCardEmptyState, CardRow } from '../components/CardComponent';
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
        const helpContainer = container.createDiv('tasknotes-settings__help-section');
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



function renderRelativeReminderConfig(reminder: DefaultReminder, updateItem: (updates: Partial<DefaultReminder>) => void): CardRow[] {
    const offsetInput = createCardNumberInput(1, undefined, 1, reminder.offset);
    offsetInput.addEventListener('input', () => {
        const offset = parseInt(offsetInput.value);
        if (!isNaN(offset) && offset > 0) {
            updateItem({ offset });
        }
    });

    const unitSelect = createCardSelect([
        { value: 'minutes', label: 'minutes' },
        { value: 'hours', label: 'hours' },
        { value: 'days', label: 'days' }
    ], reminder.unit);
    unitSelect.addEventListener('change', () => {
        updateItem({ unit: unitSelect.value as any });
    });

    const directionSelect = createCardSelect([
        { value: 'before', label: 'before' },
        { value: 'after', label: 'after' }
    ], reminder.direction);
    directionSelect.addEventListener('change', () => {
        updateItem({ direction: directionSelect.value as any });
    });

    const relatedToSelect = createCardSelect([
        { value: 'due', label: 'due date' },
        { value: 'scheduled', label: 'scheduled date' }
    ], reminder.relatedTo);
    relatedToSelect.addEventListener('change', () => {
        updateItem({ relatedTo: relatedToSelect.value as any });
    });

    return [
        { label: 'Offset:', input: offsetInput },
        { label: 'Unit:', input: unitSelect },
        { label: 'Direction:', input: directionSelect },
        { label: 'Related to:', input: relatedToSelect }
    ];
}

function renderAbsoluteReminderConfig(reminder: DefaultReminder, updateItem: (updates: Partial<DefaultReminder>) => void): CardRow[] {
    const dateInput = createCardInput('date', reminder.absoluteDate || new Date().toISOString().split('T')[0]);
    dateInput.addEventListener('input', () => {
        updateItem({ absoluteDate: dateInput.value });
    });

    const timeInput = createCardInput('time', reminder.absoluteTime || '09:00');
    timeInput.addEventListener('input', () => {
        updateItem({ absoluteTime: timeInput.value });
    });

    return [
        { label: 'Date:', input: dateInput },
        { label: 'Time:', input: timeInput }
    ];
}

function renderRemindersList(container: HTMLElement, plugin: TaskNotesPlugin, save: () => void): void {
    container.empty();
    
    if (!plugin.settings.taskCreationDefaults.defaultReminders || plugin.settings.taskCreationDefaults.defaultReminders.length === 0) {
        showCardEmptyState(
            container,
            'No default reminders configured. Add a reminder to automatically notify you about new tasks.',
            'Add Reminder',
            () => {
                // Trigger the add reminder button
                const addReminderButton = document.querySelector('[data-setting-name="Add default reminder"] button');
                if (addReminderButton) {
                    (addReminderButton as HTMLElement).click();
                }
            }
        );
        return;
    }

    plugin.settings.taskCreationDefaults.defaultReminders.forEach((reminder, index) => {
        const timingText = formatReminderTiming(reminder);

        const descInput = createCardInput('text', 'Reminder description', reminder.description);
        descInput.addEventListener('input', () => {
            reminder.description = descInput.value;
            save();
            const card = container.querySelector(`[data-card-id="${reminder.id}"]`);
            if (card) {
                const primaryText = card.querySelector('.tasknotes-card-primary-text');
                if (primaryText) {
                    primaryText.textContent = reminder.description || 'Unnamed Reminder';
                }
            }
        });

        const typeSelect = createCardSelect([
            { value: 'relative', label: 'Relative (before/after task dates)' },
            { value: 'absolute', label: 'Absolute (specific date/time)' }
        ], reminder.type);

        const updateCallback = (updates: Partial<DefaultReminder>) => {
            Object.assign(reminder, updates);
            save();
            const card = container.querySelector(`[data-card-id="${reminder.id}"]`);
            if (card) {
                const secondaryText = card.querySelector('.tasknotes-card-secondary-text');
                if (secondaryText) {
                    secondaryText.textContent = formatReminderTiming(reminder);
                }
            }
        };

        const configRows = reminder.type === 'relative'
            ? renderRelativeReminderConfig(reminder, updateCallback)
            : renderAbsoluteReminderConfig(reminder, updateCallback);

        typeSelect.addEventListener('change', () => {
            reminder.type = typeSelect.value as any;
            save();
            renderRemindersList(container, plugin, save);
        });

        createCard(container, {
            id: reminder.id,
            header: {
                primaryText: reminder.description || 'Unnamed Reminder',
                secondaryText: timingText,
                actions: [
                    createDeleteHeaderButton(() => {
                        plugin.settings.taskCreationDefaults.defaultReminders.splice(index, 1);
                        save();
                        renderRemindersList(container, plugin, save);
                    }, 'Delete reminder')
                ]
            },
            content: {
                sections: [
                    {
                        rows: [
                            { label: 'Description:', input: descInput, fullWidth: true },
                            { label: 'Type:', input: typeSelect, fullWidth: true }
                        ]
                    },
                    {
                        rows: configRows
                    }
                ]
            }
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

