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
import type { TranslationKey } from '../../i18n';

// interface ReminderItem extends ListEditorItem, DefaultReminder {}

/**
 * Renders the Defaults & Templates tab - settings for speeding up new task creation
 */
export function renderDefaultsTab(container: HTMLElement, plugin: TaskNotesPlugin, save: () => void): void {
    container.empty();

    const translate = (key: TranslationKey, params?: Record<string, string | number>) => plugin.i18n.translate(key, params);

    // Basic Defaults Section
    createSectionHeader(container, translate('settings.defaults.header.basicDefaults'));
    createHelpText(container, translate('settings.defaults.description.basicDefaults'));

    createDropdownSetting(container, {
        name: translate('settings.defaults.basicDefaults.defaultStatus.name'),
        desc: translate('settings.defaults.basicDefaults.defaultStatus.description'),
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
        name: translate('settings.defaults.basicDefaults.defaultPriority.name'),
        desc: translate('settings.defaults.basicDefaults.defaultPriority.description'),
        options: [
            { value: '', label: translate('settings.defaults.options.noDefault') },
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
        name: translate('settings.defaults.basicDefaults.defaultContexts.name'),
        desc: translate('settings.defaults.basicDefaults.defaultContexts.description'),
        placeholder: translate('settings.defaults.basicDefaults.defaultContexts.placeholder'),
        getValue: () => plugin.settings.taskCreationDefaults.defaultContexts,
        setValue: async (value: string) => {
            plugin.settings.taskCreationDefaults.defaultContexts = value;
            save();
        }
    });

    createTextSetting(container, {
        name: translate('settings.defaults.basicDefaults.defaultTags.name'),
        desc: translate('settings.defaults.basicDefaults.defaultTags.description'),
        placeholder: translate('settings.defaults.basicDefaults.defaultTags.placeholder'),
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
        .setName(translate('settings.defaults.basicDefaults.defaultProjects.name'))
        .setDesc(translate('settings.defaults.basicDefaults.defaultProjects.description'))
        .addButton(button => {
            button.setButtonText(translate('settings.defaults.basicDefaults.defaultProjects.selectButton'))
                  .setTooltip(translate('settings.defaults.basicDefaults.defaultProjects.selectTooltip'))
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
                                  renderDefaultProjectsList(defaultProjectsContainer, plugin, save, selectedDefaultProjectFiles, translate);
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

    renderDefaultProjectsList(defaultProjectsContainer, plugin, save, selectedDefaultProjectFiles, translate);

    createToggleSetting(container, {
        name: translate('settings.defaults.basicDefaults.useParentNoteAsProject.name'),
        desc: translate('settings.defaults.basicDefaults.useParentNoteAsProject.description'),
        getValue: () => plugin.settings.taskCreationDefaults.useParentNoteAsProject,
        setValue: async (value: boolean) => {
            plugin.settings.taskCreationDefaults.useParentNoteAsProject = value;
            save();
        }
    });

    createNumberSetting(container, {
        name: translate('settings.defaults.basicDefaults.defaultTimeEstimate.name'),
        desc: translate('settings.defaults.basicDefaults.defaultTimeEstimate.description'),
        placeholder: translate('settings.defaults.basicDefaults.defaultTimeEstimate.placeholder'),
        min: 0,
        getValue: () => plugin.settings.taskCreationDefaults.defaultTimeEstimate,
        setValue: async (value: number) => {
            plugin.settings.taskCreationDefaults.defaultTimeEstimate = value;
            save();
        }
    });

    createDropdownSetting(container, {
        name: translate('settings.defaults.basicDefaults.defaultRecurrence.name'),
        desc: translate('settings.defaults.basicDefaults.defaultRecurrence.description'),
        options: [
            { value: 'none', label: translate('settings.defaults.options.none') },
            { value: 'daily', label: translate('settings.defaults.options.daily') },
            { value: 'weekly', label: translate('settings.defaults.options.weekly') },
            { value: 'monthly', label: translate('settings.defaults.options.monthly') },
            { value: 'yearly', label: translate('settings.defaults.options.yearly') }
        ],
        getValue: () => plugin.settings.taskCreationDefaults.defaultRecurrence,
        setValue: async (value: string) => {
            plugin.settings.taskCreationDefaults.defaultRecurrence = value as any;
            save();
        }
    });

    // Date Defaults Section
    createSectionHeader(container, translate('settings.defaults.header.dateDefaults'));
    createHelpText(container, translate('settings.defaults.description.dateDefaults'));

    createDropdownSetting(container, {
        name: translate('settings.defaults.dateDefaults.defaultDueDate.name'),
        desc: translate('settings.defaults.dateDefaults.defaultDueDate.description'),
        options: [
            { value: 'none', label: translate('settings.defaults.options.none') },
            { value: 'today', label: translate('settings.defaults.options.today') },
            { value: 'tomorrow', label: translate('settings.defaults.options.tomorrow') },
            { value: 'next-week', label: translate('settings.defaults.options.nextWeek') }
        ],
        getValue: () => plugin.settings.taskCreationDefaults.defaultDueDate,
        setValue: async (value: string) => {
            plugin.settings.taskCreationDefaults.defaultDueDate = value as any;
            save();
        }
    });

    createDropdownSetting(container, {
        name: translate('settings.defaults.dateDefaults.defaultScheduledDate.name'),
        desc: translate('settings.defaults.dateDefaults.defaultScheduledDate.description'),
        options: [
            { value: 'none', label: translate('settings.defaults.options.none') },
            { value: 'today', label: translate('settings.defaults.options.today') },
            { value: 'tomorrow', label: translate('settings.defaults.options.tomorrow') },
            { value: 'next-week', label: translate('settings.defaults.options.nextWeek') }
        ],
        getValue: () => plugin.settings.taskCreationDefaults.defaultScheduledDate,
        setValue: async (value: string) => {
            plugin.settings.taskCreationDefaults.defaultScheduledDate = value as any;
            save();
        }
    });

    // Reminder Defaults Section
    createSectionHeader(container, translate('settings.defaults.header.defaultReminders'));
    createHelpText(container, translate('settings.defaults.description.defaultReminders'));

    // Reminder list - using card layout
    const remindersContainer = container.createDiv('tasknotes-reminders-container');
    renderRemindersList(remindersContainer, plugin, save, translate);
    
    // Add reminder button
    new Setting(container)
        .setName(translate('settings.defaults.reminders.addReminder.name'))
        .setDesc(translate('settings.defaults.reminders.addReminder.description'))
        .addButton(button => button
            .setButtonText(translate('settings.defaults.reminders.addReminder.buttonText'))
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
                renderRemindersList(remindersContainer, plugin, save, translate);
            }));

    // Template Settings Section
    createSectionHeader(container, translate('settings.defaults.header.bodyTemplate'));
    createHelpText(container, translate('settings.defaults.description.bodyTemplate'));

    createToggleSetting(container, {
        name: translate('settings.defaults.bodyTemplate.useBodyTemplate.name'),
        desc: translate('settings.defaults.bodyTemplate.useBodyTemplate.description'),
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
            name: translate('settings.defaults.bodyTemplate.bodyTemplateFile.name'),
            desc: translate('settings.defaults.bodyTemplate.bodyTemplateFile.description'),
            placeholder: translate('settings.defaults.bodyTemplate.bodyTemplateFile.placeholder'),
            getValue: () => plugin.settings.taskCreationDefaults.bodyTemplate,
            setValue: async (value: string) => {
                plugin.settings.taskCreationDefaults.bodyTemplate = value;
                save();
            },
            ariaLabel: translate('settings.defaults.bodyTemplate.bodyTemplateFile.ariaLabel')
        });
    }

    // Template Variables Help
    if (plugin.settings.taskCreationDefaults.useBodyTemplate) {
        const helpContainer = container.createDiv('tasknotes-settings__help-section');
        helpContainer.createEl('h4', { text: translate('settings.defaults.bodyTemplate.variablesHeader') });
        const helpList = helpContainer.createEl('ul');
        helpList.createEl('li', { text: translate('settings.defaults.bodyTemplate.variables.title') });
        helpList.createEl('li', { text: translate('settings.defaults.bodyTemplate.variables.details') });
        helpList.createEl('li', { text: translate('settings.defaults.bodyTemplate.variables.date') });
        helpList.createEl('li', { text: translate('settings.defaults.bodyTemplate.variables.time') });
        helpList.createEl('li', { text: translate('settings.defaults.bodyTemplate.variables.priority') });
        helpList.createEl('li', { text: translate('settings.defaults.bodyTemplate.variables.status') });
        helpList.createEl('li', { text: translate('settings.defaults.bodyTemplate.variables.contexts') });
        helpList.createEl('li', { text: translate('settings.defaults.bodyTemplate.variables.tags') });
        helpList.createEl('li', { text: translate('settings.defaults.bodyTemplate.variables.projects') });
    }

    // Instant Conversion Section
    createSectionHeader(container, translate('settings.defaults.header.instantTaskConversion'));
    createHelpText(container, translate('settings.defaults.description.instantTaskConversion'));

    createToggleSetting(container, {
        name: translate('settings.defaults.instantConversion.useDefaultsOnInstantConvert.name'),
        desc: translate('settings.defaults.instantConversion.useDefaultsOnInstantConvert.description'),
        getValue: () => plugin.settings.useDefaultsOnInstantConvert,
        setValue: async (value: boolean) => {
            plugin.settings.useDefaultsOnInstantConvert = value;
            save();
        }
    });
}

function renderDefaultProjectsList(container: HTMLElement, plugin: TaskNotesPlugin, save: () => void, selectedFiles: TAbstractFile[], translate: (key: TranslationKey, params?: Record<string, string | number>) => string): void {
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
            collapsible: true,
            defaultCollapsed: true,
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
                            renderDefaultProjectsList(container, plugin, save, selectedFiles, translate);
                        }
                    }, translate('settings.defaults.basicDefaults.defaultProjects.removeTooltip', { name: file.name }))
                ]
            }
        });
    });
}



function renderRelativeReminderConfig(reminder: DefaultReminder, updateItem: (updates: Partial<DefaultReminder>) => void, translate: (key: TranslationKey, params?: Record<string, string | number>) => string): CardRow[] {
    const offsetInput = createCardNumberInput(1, undefined, 1, reminder.offset);
    offsetInput.addEventListener('input', () => {
        const offset = parseInt(offsetInput.value);
        if (!isNaN(offset) && offset > 0) {
            updateItem({ offset });
        }
    });

    const unitSelect = createCardSelect([
        { value: 'minutes', label: translate('settings.defaults.reminders.units.minutes') },
        { value: 'hours', label: translate('settings.defaults.reminders.units.hours') },
        { value: 'days', label: translate('settings.defaults.reminders.units.days') }
    ], reminder.unit);
    unitSelect.addEventListener('change', () => {
        updateItem({ unit: unitSelect.value as any });
    });

    const directionSelect = createCardSelect([
        { value: 'before', label: translate('settings.defaults.reminders.directions.before') },
        { value: 'after', label: translate('settings.defaults.reminders.directions.after') }
    ], reminder.direction);
    directionSelect.addEventListener('change', () => {
        updateItem({ direction: directionSelect.value as any });
    });

    const relatedToSelect = createCardSelect([
        { value: 'due', label: translate('settings.defaults.reminders.relatedTo.due') },
        { value: 'scheduled', label: translate('settings.defaults.reminders.relatedTo.scheduled') }
    ], reminder.relatedTo);
    relatedToSelect.addEventListener('change', () => {
        updateItem({ relatedTo: relatedToSelect.value as any });
    });

    return [
        { label: translate('settings.defaults.reminders.fields.offset'), input: offsetInput },
        { label: translate('settings.defaults.reminders.fields.unit'), input: unitSelect },
        { label: translate('settings.defaults.reminders.fields.direction'), input: directionSelect },
        { label: translate('settings.defaults.reminders.fields.relatedTo'), input: relatedToSelect }
    ];
}

function renderAbsoluteReminderConfig(reminder: DefaultReminder, updateItem: (updates: Partial<DefaultReminder>) => void, translate: (key: TranslationKey, params?: Record<string, string | number>) => string): CardRow[] {
    const dateInput = createCardInput('date', reminder.absoluteDate || new Date().toISOString().split('T')[0]);
    dateInput.addEventListener('input', () => {
        updateItem({ absoluteDate: dateInput.value });
    });

    const timeInput = createCardInput('time', reminder.absoluteTime || '09:00');
    timeInput.addEventListener('input', () => {
        updateItem({ absoluteTime: timeInput.value });
    });

    return [
        { label: translate('settings.defaults.reminders.fields.date'), input: dateInput },
        { label: translate('settings.defaults.reminders.fields.time'), input: timeInput }
    ];
}

function renderRemindersList(container: HTMLElement, plugin: TaskNotesPlugin, save: () => void, translate: (key: TranslationKey, params?: Record<string, string | number>) => string): void {
    container.empty();
    
    if (!plugin.settings.taskCreationDefaults.defaultReminders || plugin.settings.taskCreationDefaults.defaultReminders.length === 0) {
        showCardEmptyState(
            container,
            translate('settings.defaults.reminders.emptyState'),
            translate('settings.defaults.reminders.emptyStateButton'),
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
        const timingText = formatReminderTiming(reminder, translate);

        const descInput = createCardInput('text', translate('settings.defaults.reminders.reminderDescription'), reminder.description);
        

        const typeSelect = createCardSelect([
            { value: 'relative', label: translate('settings.defaults.reminders.types.relative') },
            { value: 'absolute', label: translate('settings.defaults.reminders.types.absolute') }
        ], reminder.type);

        const updateCallback = (updates: Partial<DefaultReminder>) => {
            Object.assign(reminder, updates);
            save();
            const card = container.querySelector(`[data-card-id="${reminder.id}"]`);
            if (card) {
                const secondaryText = card.querySelector('.tasknotes-settings__card-secondary-text');
                if (secondaryText) {
                    secondaryText.textContent = formatReminderTiming(reminder, translate);
                }
            }
        };

        const configRows = reminder.type === 'relative'
            ? renderRelativeReminderConfig(reminder, updateCallback, translate)
            : renderAbsoluteReminderConfig(reminder, updateCallback, translate);

        const card = createCard(container, {
            id: reminder.id,
            collapsible: true,
            defaultCollapsed: true,
            header: {
                primaryText: reminder.description || translate('settings.defaults.reminders.unnamedReminder'),
                secondaryText: timingText,
                actions: [
                    createDeleteHeaderButton(() => {
                        plugin.settings.taskCreationDefaults.defaultReminders.splice(index, 1);
                        save();
                        renderRemindersList(container, plugin, save, translate);
                    }, translate('settings.defaults.reminders.deleteTooltip'))
                ]
            },
            content: {
                sections: [
                    {
                        rows: [
                            { label: translate('settings.defaults.reminders.fields.description'), input: descInput },
                            { label: translate('settings.defaults.reminders.fields.type'), input: typeSelect }
                        ]
                    },
                    {
                        rows: configRows
                    }
                ]
            }
        });

        descInput.addEventListener('input', () => {
            reminder.description = descInput.value;
            save();
            const primaryText = card.querySelector('.tasknotes-settings__card-primary-text');
            if (primaryText) {
                primaryText.textContent = reminder.description || translate('settings.defaults.reminders.unnamedReminder');
            }
        });

        typeSelect.addEventListener('change', () => {
            reminder.type = typeSelect.value as any;
            save();
            
            // Re-render only the config rows
            const newConfigRows = reminder.type === 'relative'
                ? renderRelativeReminderConfig(reminder, updateCallback, translate)
                : renderAbsoluteReminderConfig(reminder, updateCallback, translate);
            
            const content = card.querySelector('.tasknotes-settings__card-content');
            if (content && content.children[1]) {
                const newSection = document.createElement('div');
                newConfigRows.forEach(row => {
                    const configRow = newSection.createDiv('tasknotes-settings__card-config-row');
                    if (row.fullWidth) {
                        configRow.style.flexDirection = 'column';
                        configRow.style.alignItems = 'flex-start';
                        configRow.style.gap = '0.5rem';
                    }
                    const label = configRow.createSpan('tasknotes-settings__card-config-label');
                    label.textContent = row.label;
                    configRow.appendChild(row.input);
                });
                content.replaceChild(newSection, content.children[1]);
            }
        });
    });
}

function formatReminderTiming(reminder: DefaultReminder, translate: (key: TranslationKey, params?: Record<string, string | number>) => string): string {
    if (reminder.type === 'relative') {
        const direction = reminder.direction === 'before' ? translate('settings.defaults.reminders.directions.before') : translate('settings.defaults.reminders.directions.after');
        const unit = translate(`settings.defaults.reminders.units.${reminder.unit || 'hours'}` as TranslationKey);
        const offset = reminder.offset || 1;
        const relatedTo = reminder.relatedTo === 'due' ? translate('settings.defaults.reminders.relatedTo.due') : translate('settings.defaults.reminders.relatedTo.scheduled');
        return `${offset} ${unit} ${direction} ${relatedTo}`;
    } else {
        const date = reminder.absoluteDate || translate('settings.defaults.reminders.fields.date');
        const time = reminder.absoluteTime || translate('settings.defaults.reminders.fields.time');
        return `${date} at ${time}`;
    }
}

