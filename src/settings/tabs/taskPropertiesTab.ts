import { Notice, setTooltip, Setting } from 'obsidian';
import TaskNotesPlugin from '../../main';
import { StatusConfig, FieldMapping } from '../../types';
import { TranslationKey } from '../../i18n';
// import { UserMappedField } from '../../types/settings';
import { 
    createSectionHeader, 
    createHelpText,
    createValidationNote,
    // createListHeaders,
    createButtonSetting
} from '../components/settingHelpers';
import { 
    createCard, 
    createStatusBadge, 
    createCardInput, 
    setupCardDragAndDrop,
    createDeleteHeaderButton,
    CardConfig,
    showCardEmptyState,
    createCardNumberInput,
    createCardSelect
} from '../components/CardComponent';
// import { ListEditorComponent, ListEditorItem } from '../components/ListEditorComponent';

// interface StatusItem extends ListEditorItem, StatusConfig {}
// interface PriorityItem extends ListEditorItem, PriorityConfig {}
// interface UserFieldItem extends ListEditorItem, UserMappedField {}

/**
 * Renders the Task Properties tab - custom statuses, priorities, and user fields
 */
export function renderTaskPropertiesTab(container: HTMLElement, plugin: TaskNotesPlugin, save: () => void): void {
    container.empty();

    const translate = (key: TranslationKey, params?: Record<string, string | number>) => plugin.i18n.translate(key, params);

    // Ensure user fields array exists
    if (!Array.isArray(plugin.settings.userFields)) {
        plugin.settings.userFields = [];
    }

    // Custom Statuses Section
    createSectionHeader(container, translate('settings.taskProperties.taskStatuses.header'));
    createHelpText(container, translate('settings.taskProperties.taskStatuses.description'));

    // Status help section
    const statusHelpContainer = container.createDiv('tasknotes-settings__help-section');
    statusHelpContainer.createEl('h4', { text: translate('settings.taskProperties.taskStatuses.howTheyWork.title') });
    const statusHelpList = statusHelpContainer.createEl('ul');
    statusHelpList.createEl('li', { text: translate('settings.taskProperties.taskStatuses.howTheyWork.value') });
    statusHelpList.createEl('li', { text: translate('settings.taskProperties.taskStatuses.howTheyWork.label') });
    statusHelpList.createEl('li', { text: translate('settings.taskProperties.taskStatuses.howTheyWork.color') });
    statusHelpList.createEl('li', { text: translate('settings.taskProperties.taskStatuses.howTheyWork.completed') });
    statusHelpList.createEl('li', { text: translate('settings.taskProperties.taskStatuses.howTheyWork.autoArchive') });
    statusHelpContainer.createEl('p', {
        text: translate('settings.taskProperties.taskStatuses.howTheyWork.orderNote'),
        cls: 'settings-help-note'
    });

    // Status list container - using card layout like webhooks
    const statusList = container.createDiv('tasknotes-statuses-container');
    renderStatusList(statusList, plugin, save);
    
    // Add status button
    new Setting(container)
        .setName(translate('settings.taskProperties.taskStatuses.addNew.name'))
        .setDesc(translate('settings.taskProperties.taskStatuses.addNew.description'))
        .addButton(button => button
            .setButtonText(translate('settings.taskProperties.taskStatuses.addNew.buttonText'))
            .onClick(async () => {
                const newId = `status_${Date.now()}`;
                const newStatus = {
                    id: newId,
                    value: '',
                    label: '',
                    color: '#6366f1',
                    completed: false,
                    isCompleted: false,
                    order: plugin.settings.customStatuses.length,
                    autoArchive: false,
                    autoArchiveDelay: 5
                };
                plugin.settings.customStatuses.push(newStatus);
                save();
                renderStatusList(statusList, plugin, save);
            }));

    createValidationNote(container, translate('settings.taskProperties.taskStatuses.validationNote'));

    // Custom Priorities Section
    createSectionHeader(container, translate('settings.taskProperties.taskPriorities.header'));
    createHelpText(container, translate('settings.taskProperties.taskPriorities.description'));

    // Priority help section
    const priorityHelpContainer = container.createDiv('tasknotes-settings__help-section');
    priorityHelpContainer.createEl('h4', { text: translate('settings.taskProperties.taskPriorities.howTheyWork.title') });
    const priorityHelpList = priorityHelpContainer.createEl('ul');
    priorityHelpList.createEl('li', { text: translate('settings.taskProperties.taskPriorities.howTheyWork.value') });
    priorityHelpList.createEl('li', { text: translate('settings.taskProperties.taskPriorities.howTheyWork.label') });
    priorityHelpList.createEl('li', { text: translate('settings.taskProperties.taskPriorities.howTheyWork.color') });
    priorityHelpList.createEl('li', { text: translate('settings.taskProperties.taskPriorities.howTheyWork.weight') });
    priorityHelpContainer.createEl('p', {
        text: translate('settings.taskProperties.taskPriorities.howTheyWork.weightNote'),
        cls: 'settings-help-note'
    });

    // Priority list container - using card layout
    const priorityList = container.createDiv('tasknotes-priorities-container');
    renderPriorityList(priorityList, plugin, save);
    
    // Add priority button
    new Setting(container)
        .setName(translate('settings.taskProperties.taskPriorities.addNew.name'))
        .setDesc(translate('settings.taskProperties.taskPriorities.addNew.description'))
        .addButton(button => button
            .setButtonText(translate('settings.taskProperties.taskPriorities.addNew.buttonText'))
            .onClick(async () => {
                const newId = `priority_${Date.now()}`;
                const newPriority = {
                    id: newId,
                    value: '',
                    label: '',
                    color: '#6366f1',
                    weight: 1
                };
                plugin.settings.customPriorities.push(newPriority);
                save();
                renderPriorityList(priorityList, plugin, save);
            }));

    createValidationNote(container, translate('settings.taskProperties.taskPriorities.validationNote'));

    // Field Mapping Section
    createSectionHeader(container, translate('settings.taskProperties.fieldMapping.header'));

    // Warning message
    const warning = container.createDiv('tasknotes-settings__warning');
    warning.appendText(translate('settings.taskProperties.fieldMapping.warning'));

    createHelpText(container, translate('settings.taskProperties.fieldMapping.description'));

    renderFieldMappingTable(container, plugin, save);

    createButtonSetting(container, {
        name: translate('settings.taskProperties.fieldMapping.resetButton.name'),
        desc: translate('settings.taskProperties.fieldMapping.resetButton.description'),
        buttonText: translate('settings.taskProperties.fieldMapping.resetButton.buttonText'),
        onClick: async () => {
            // Import the DEFAULT_FIELD_MAPPING - we'll need to check if this is accessible
            try {
                const { DEFAULT_FIELD_MAPPING } = await import('../../settings/defaults');
                plugin.settings.fieldMapping = { ...DEFAULT_FIELD_MAPPING };
                save();
                renderTaskPropertiesTab(container.parentElement!, plugin, save);
                new Notice(translate('settings.taskProperties.fieldMapping.notices.resetSuccess'));
            } catch (error) {
                console.error('Error resetting field mappings:', error);
                new Notice(translate('settings.taskProperties.fieldMapping.notices.resetFailure'));
            }
        }
    });

    // Custom User Fields Section
    createSectionHeader(container, translate('settings.taskProperties.customUserFields.header'));
    createHelpText(container, translate('settings.taskProperties.customUserFields.description'));

    // Migrate legacy single field if present
    if (plugin.settings.userField && plugin.settings.userField.enabled) {
        const legacy = plugin.settings.userField;
        const id = (legacy.displayName || legacy.key || 'field').toLowerCase().replace(/[^a-z0-9_-]/g, '-');
        if (!plugin.settings.userFields.find(f => (f.id === id) || (f.key === legacy.key))) {
            plugin.settings.userFields.push({ 
                id, 
                displayName: legacy.displayName || '', 
                key: legacy.key || '', 
                type: legacy.type || 'text' 
            });
            save();
        }
    }

    // User fields list - using card layout
    const userFieldsContainer = container.createDiv('tasknotes-user-fields-container');
    renderUserFieldsList(userFieldsContainer, plugin, save);
    
    // Add user field button
    new Setting(container)
        .setName(translate('settings.taskProperties.customUserFields.addNew.name'))
        .setDesc(translate('settings.taskProperties.customUserFields.addNew.description'))
        .addButton(button => button
            .setButtonText(translate('settings.taskProperties.customUserFields.addNew.buttonText'))
            .onClick(async () => {
                if (!plugin.settings.userFields) {
                    plugin.settings.userFields = [];
                }
                const newId = `field_${Date.now()}`;
                const newField = {
                    id: newId,
                    displayName: '',
                    key: '',
                    type: 'text' as const
                };
                plugin.settings.userFields.push(newField);
                save();
                renderUserFieldsList(userFieldsContainer, plugin, save);
            }));;

}

function renderStatusList(container: HTMLElement, plugin: TaskNotesPlugin, save: () => void): void {
    container.empty();

    const translate = (key: TranslationKey, params?: Record<string, string | number>) => plugin.i18n.translate(key, params);

    if (!plugin.settings.customStatuses || plugin.settings.customStatuses.length === 0) {
        showCardEmptyState(
            container,
            translate('settings.taskProperties.taskStatuses.emptyState'),
            translate('settings.taskProperties.taskStatuses.emptyStateButton'),
            () => {
                const addStatusButton = document.querySelector('[data-setting-name="Add new status"] button');
                if (addStatusButton) {
                    (addStatusButton as HTMLElement).click();
                }
            }
        );
        return;
    }

    const sortedStatuses = [...plugin.settings.customStatuses].sort((a, b) => a.order - b.order);

    sortedStatuses.forEach((status) => {
        const valueInput = createCardInput('text', translate('settings.taskProperties.taskStatuses.placeholders.value'), status.value);
        const labelInput = createCardInput('text', translate('settings.taskProperties.taskStatuses.placeholders.label'), status.label);
        const colorInput = createCardInput('color', '', status.color);
        
        const completedCheckbox = document.createElement('input');
        completedCheckbox.type = 'checkbox';
        completedCheckbox.checked = status.isCompleted || false;
        completedCheckbox.addClass('tasknotes-card-input');

        const autoArchiveCheckbox = document.createElement('input');
        autoArchiveCheckbox.type = 'checkbox';
        autoArchiveCheckbox.checked = status.autoArchive || false;
        autoArchiveCheckbox.addClass('tasknotes-card-input');

        const autoArchiveDelayInput = createCardNumberInput(1, 1440, 1, status.autoArchiveDelay || 5);

        const metaElements = status.isCompleted ? [createStatusBadge(translate('settings.taskProperties.taskStatuses.badges.completed'), 'completed')] : [];

        const deleteStatus = () => {
            const confirmDelete = confirm(translate('settings.taskProperties.taskStatuses.deleteConfirm', { label: status.label || status.value }));
            if (confirmDelete) {
                const statusIndex = plugin.settings.customStatuses.findIndex(s => s.id === status.id);
                if (statusIndex !== -1) {
                    plugin.settings.customStatuses.splice(statusIndex, 1);
                    plugin.settings.customStatuses.forEach((s, i) => { s.order = i; });
                    save();
                    renderStatusList(container, plugin, save);
                }
            }
        };

        const cardConfig: CardConfig = {
            id: status.id,
            draggable: true,
            collapsible: true,
            defaultCollapsed: true,
            colorIndicator: { color: status.color, cssVar: '--status-color' },
            header: {
                primaryText: status.value || 'untitled',
                secondaryText: status.label || 'No label',
                meta: metaElements,
                actions: [createDeleteHeaderButton(deleteStatus)]
            },
            content: {
                sections: [{
                    rows: [
                        { label: translate('settings.taskProperties.taskStatuses.fields.value'), input: valueInput },
                        { label: translate('settings.taskProperties.taskStatuses.fields.label'), input: labelInput },
                        { label: translate('settings.taskProperties.taskStatuses.fields.color'), input: colorInput },
                        { label: translate('settings.taskProperties.taskStatuses.fields.completed'), input: completedCheckbox },
                        { label: translate('settings.taskProperties.taskStatuses.fields.autoArchive'), input: autoArchiveCheckbox },
                        { label: translate('settings.taskProperties.taskStatuses.fields.delayMinutes'), input: autoArchiveDelayInput }
                    ]
                }]
            }
        };

        const statusCard = createCard(container, cardConfig);

        // Function to show/hide the delay input based on auto-archive setting
        const updateDelayInputVisibility = () => {
            // Find the delay input row by looking for the input element's parent row
            const delayRow = autoArchiveDelayInput.closest('.tasknotes-settings__card-config-row') as HTMLElement;
            if (delayRow) {
                delayRow.style.display = status.autoArchive ? 'flex' : 'none';
            }
        };

        // Set initial visibility
        updateDelayInputVisibility();

        valueInput.addEventListener('change', () => {
            status.value = valueInput.value;
            statusCard.querySelector('.tasknotes-settings__card-primary-text')!.textContent = status.value || 'untitled';
            save();
        });
    
        labelInput.addEventListener('change', () => {
            status.label = labelInput.value;
            statusCard.querySelector('.tasknotes-settings__card-secondary-text')!.textContent = status.label || 'No label';
            save();
        });
    
        colorInput.addEventListener('change', () => {
            status.color = colorInput.value;
            const colorIndicator = statusCard.querySelector('.tasknotes-settings__card-color-indicator') as HTMLElement;
            if (colorIndicator) {
                colorIndicator.style.backgroundColor = status.color;
            }
            save();
        });
    
        completedCheckbox.addEventListener('change', () => {
            status.isCompleted = completedCheckbox.checked;
            const metaContainer = statusCard.querySelector('.tasknotes-settings__card-meta');
            if (metaContainer) {
                metaContainer.empty();
                if (status.isCompleted) {
                    metaContainer.appendChild(createStatusBadge(translate('settings.taskProperties.taskStatuses.badges.completed'), 'completed'));
                }
            }
            save();
        });

        autoArchiveCheckbox.addEventListener('change', () => {
            status.autoArchive = autoArchiveCheckbox.checked;
            save();
            // Update delay input visibility without re-rendering
            updateDelayInputVisibility();
        });

        autoArchiveDelayInput.addEventListener('change', () => {
            const value = parseInt(autoArchiveDelayInput.value);
            if (!isNaN(value) && value >= 1 && value <= 1440) {
                status.autoArchiveDelay = value;
                save();
            }
        });

        setupCardDragAndDrop(statusCard, container, (draggedId, targetId, insertBefore) => {
            const draggedIndex = plugin.settings.customStatuses.findIndex(s => s.id === draggedId);
            const targetIndex = plugin.settings.customStatuses.findIndex(s => s.id === targetId);
        
            if (draggedIndex === -1 || targetIndex === -1) return;
        
            const reorderedStatuses = [...plugin.settings.customStatuses];
            const [draggedStatus] = reorderedStatuses.splice(draggedIndex, 1);
            
            let newIndex = targetIndex;
            if (draggedIndex < targetIndex) newIndex = targetIndex - 1;
            if (!insertBefore) newIndex++;
            
            reorderedStatuses.splice(newIndex, 0, draggedStatus);
            reorderedStatuses.forEach((s, i) => { s.order = i; });
            
            plugin.settings.customStatuses = reorderedStatuses;
            save();
            renderStatusList(container, plugin, save);
        });
    });
}



function renderPriorityList(container: HTMLElement, plugin: TaskNotesPlugin, save: () => void): void {
    container.empty();

    const translate = (key: TranslationKey, params?: Record<string, string | number>) => plugin.i18n.translate(key, params);

    if (!plugin.settings.customPriorities || plugin.settings.customPriorities.length === 0) {
        showCardEmptyState(
            container,
            translate('settings.taskProperties.taskPriorities.emptyState'),
            translate('settings.taskProperties.taskPriorities.emptyStateButton'),
            () => {
                const addPriorityButton = document.querySelector('[data-setting-name="Add new priority"] button');
                if (addPriorityButton) {
                    (addPriorityButton as HTMLElement).click();
                }
            }
        );
        return;
    }
    
    const sortedPriorities = [...plugin.settings.customPriorities].sort((a, b) => b.weight - a.weight);
    
    sortedPriorities.forEach((priority, index) => {
        const valueInput = createCardInput('text', translate('settings.taskProperties.taskPriorities.placeholders.value'), priority.value);
        const labelInput = createCardInput('text', translate('settings.taskProperties.taskPriorities.placeholders.label'), priority.label);
        const colorInput = createCardInput('color', '', priority.color);
        const weightInput = createCardNumberInput(0, undefined, 1, priority.weight);

        const card = createCard(container, {
            id: priority.id,
            collapsible: true,
            defaultCollapsed: true,
            colorIndicator: { color: priority.color },
            header: {
                primaryText: priority.label || priority.value || 'untitled',
                secondaryText: translate('settings.taskProperties.taskPriorities.weightLabel', { weight: priority.weight }),
                actions: [
                    createDeleteHeaderButton(() => {
                        if (plugin.settings.customPriorities.length <= 1) {
                            new Notice(translate('settings.taskProperties.taskPriorities.deleteConfirm'));
                            return;
                        }
                        plugin.settings.customPriorities.splice(index, 1);
                        save();
                        renderPriorityList(container, plugin, save);
                    }, translate('settings.taskProperties.taskPriorities.deleteTooltip'))
                ]
            },
            content: {
                sections: [{
                    rows: [
                        { label: translate('settings.taskProperties.taskPriorities.fields.value'), input: valueInput },
                        { label: translate('settings.taskProperties.taskPriorities.fields.label'), input: labelInput },
                        { label: translate('settings.taskProperties.taskPriorities.fields.color'), input: colorInput },
                        { label: translate('settings.taskProperties.taskPriorities.fields.weight'), input: weightInput }
                    ]
                }]
            }
        });

        valueInput.addEventListener('change', () => {
            priority.value = valueInput.value;
            save();
        });

        labelInput.addEventListener('change', () => {
            priority.label = labelInput.value;
            card.querySelector('.tasknotes-settings__card-primary-text')!.textContent = priority.label || priority.value || 'untitled';
            save();
        });

        colorInput.addEventListener('change', () => {
            priority.color = colorInput.value;
            const colorIndicator = card.querySelector('.tasknotes-settings__card-color-indicator') as HTMLElement;
            if (colorIndicator) {
                colorIndicator.style.backgroundColor = priority.color;
            }
            save();
        });

        weightInput.addEventListener('input', () => {
            const weight = parseInt(weightInput.value);
            if (!isNaN(weight) && weight >= 0) {
                priority.weight = weight;
                card.querySelector('.tasknotes-settings__card-secondary-text')!.textContent = translate('settings.taskProperties.taskPriorities.weightLabel', { weight: priority.weight });
                save();
            }
        });
    });
}

function setupStatusDragAndDrop(statusRow: HTMLElement, status: StatusConfig, container: HTMLElement, plugin: TaskNotesPlugin, save: () => void): void {
    statusRow.addEventListener('dragstart', (e) => {
        if (e.dataTransfer) {
            e.dataTransfer.setData('text/plain', status.id);
            statusRow.classList.add('dragging');
        }
    });

    statusRow.addEventListener('dragend', () => {
        statusRow.classList.remove('dragging');
        // Clean up all drag indicators
        container.querySelectorAll('.drag-over-top, .drag-over-bottom').forEach(el => {
            el.classList.remove('drag-over-top', 'drag-over-bottom');
        });
    });

    statusRow.addEventListener('dragover', (e) => {
        e.preventDefault();
        const draggingRow = container.querySelector('.dragging') as HTMLElement;
        if (draggingRow && draggingRow !== statusRow) {
            const rect = statusRow.getBoundingClientRect();
            const midpoint = rect.top + rect.height / 2;
            if (e.clientY < midpoint) {
                statusRow.classList.add('drag-over-top');
                statusRow.classList.remove('drag-over-bottom');
            } else {
                statusRow.classList.add('drag-over-bottom');
                statusRow.classList.remove('drag-over-top');
            }
        }
    });

    statusRow.addEventListener('dragleave', () => {
        statusRow.classList.remove('drag-over-top', 'drag-over-bottom');
    });

    statusRow.addEventListener('drop', (e) => {
        e.preventDefault();
        const draggedId = e.dataTransfer?.getData('text/plain');
        if (!draggedId || draggedId === status.id) return;

        // Clear drag visual indicators
        statusRow.classList.remove('drag-over-top', 'drag-over-bottom');

        // Find the dragged and target statuses
        const draggedIndex = plugin.settings.customStatuses.findIndex(s => s.id === draggedId);
        const targetIndex = plugin.settings.customStatuses.findIndex(s => s.id === status.id);
        
        if (draggedIndex === -1 || targetIndex === -1) return;

        // Determine insertion point based on drop position
        const rect = statusRow.getBoundingClientRect();
        const midpoint = rect.top + rect.height / 2;
        const insertBefore = e.clientY < midpoint;
        
        // Reorder statuses array
        const reorderedStatuses = [...plugin.settings.customStatuses];
        const [draggedStatus] = reorderedStatuses.splice(draggedIndex, 1);
        
        let insertIndex = targetIndex;
        if (draggedIndex < targetIndex && !insertBefore) {
            insertIndex = targetIndex; // Already adjusted due to removal
        } else if (draggedIndex < targetIndex && insertBefore) {
            insertIndex = targetIndex - 1;
        } else if (draggedIndex > targetIndex && insertBefore) {
            insertIndex = targetIndex;
        } else if (draggedIndex > targetIndex && !insertBefore) {
            insertIndex = targetIndex + 1;
        }

        reorderedStatuses.splice(insertIndex, 0, draggedStatus);
        
        // Update order property based on new array position
        reorderedStatuses.forEach((s, i) => {
            s.order = i;
        });
        
        plugin.settings.customStatuses = reorderedStatuses;
        save();
        renderStatusList(container, plugin, save);
    });
}

function renderFieldMappingTable(container: HTMLElement, plugin: TaskNotesPlugin, save: () => void): void {
    const translate = (key: TranslationKey, params?: Record<string, string | number>) => plugin.i18n.translate(key, params);

    // Create mapping table
    const table = container.createEl('table', { cls: 'tasknotes-settings__table' });
    const header = table.createEl('tr');
    header.createEl('th', { cls: 'tasknotes-settings__table-header', text: translate('settings.taskProperties.fieldMapping.table.fieldHeader') });
    header.createEl('th', { cls: 'tasknotes-settings__table-header', text: translate('settings.taskProperties.fieldMapping.table.propertyHeader') });

    const fieldMappings: Array<[keyof FieldMapping, string]> = [
        ['title', translate('settings.taskProperties.fieldMapping.fields.title')],
        ['status', translate('settings.taskProperties.fieldMapping.fields.status')],
        ['priority', translate('settings.taskProperties.fieldMapping.fields.priority')],
        ['due', translate('settings.taskProperties.fieldMapping.fields.due')],
        ['scheduled', translate('settings.taskProperties.fieldMapping.fields.scheduled')],
        ['contexts', translate('settings.taskProperties.fieldMapping.fields.contexts')],
        ['projects', translate('settings.taskProperties.fieldMapping.fields.projects')],
        ['timeEstimate', translate('settings.taskProperties.fieldMapping.fields.timeEstimate')],
        ['recurrence', translate('settings.taskProperties.fieldMapping.fields.recurrence')],
        ['dateCreated', translate('settings.taskProperties.fieldMapping.fields.dateCreated')],
        ['completedDate', translate('settings.taskProperties.fieldMapping.fields.completedDate')],
        ['dateModified', translate('settings.taskProperties.fieldMapping.fields.dateModified')],
        ['archiveTag', translate('settings.taskProperties.fieldMapping.fields.archiveTag')],
        ['timeEntries', translate('settings.taskProperties.fieldMapping.fields.timeEntries')],
        ['completeInstances', translate('settings.taskProperties.fieldMapping.fields.completeInstances')],
        ['pomodoros', translate('settings.taskProperties.fieldMapping.fields.pomodoros')],
        ['icsEventId', translate('settings.taskProperties.fieldMapping.fields.icsEventId')],
        ['icsEventTag', translate('settings.taskProperties.fieldMapping.fields.icsEventTag')],
        ['reminders', translate('settings.taskProperties.fieldMapping.fields.reminders')]
    ];

    fieldMappings.forEach(([field, label]) => {
        const row = table.createEl('tr', { cls: 'tasknotes-settings__table-row' });
        const labelCell = row.createEl('td', { cls: 'tasknotes-settings__table-cell' });
        labelCell.textContent = label;
        const inputCell = row.createEl('td', { cls: 'tasknotes-settings__table-cell' });
        
        const input = inputCell.createEl('input', {
            type: 'text',
            cls: 'settings-input field-mapping-input',
            value: plugin.settings.fieldMapping[field] || '',
            attr: {
                'placeholder': field,
                'aria-label': `Property name for ${label}`
            }
        });

        input.addEventListener('change', async () => {
            try {
                plugin.settings.fieldMapping[field] = input.value;
                save();
            } catch (error) {
                console.error(`Error updating field mapping for ${field}:`, error);
                new Notice(translate('settings.taskProperties.fieldMapping.notices.updateFailure', { label }));
            }
        });
    });
}

function renderUserFieldsList(container: HTMLElement, plugin: TaskNotesPlugin, save: () => void): void {
    container.empty();

    const translate = (key: TranslationKey, params?: Record<string, string | number>) => plugin.i18n.translate(key, params);

    if (!plugin.settings.userFields) {
        plugin.settings.userFields = [];
    }

    if (plugin.settings.userFields.length === 0) {
        showCardEmptyState(
            container,
            translate('settings.taskProperties.customUserFields.emptyState'),
            translate('settings.taskProperties.customUserFields.emptyStateButton'),
            () => {
                const addUserFieldButton = document.querySelector('[data-setting-name="Add new user field"] button');
                if (addUserFieldButton) {
                    (addUserFieldButton as HTMLElement).click();
                }
            }
        );
        return;
    }

    plugin.settings.userFields.forEach((field, index) => {
        const nameInput = createCardInput('text', translate('settings.taskProperties.customUserFields.placeholders.displayName'), field.displayName);
        const keyInput = createCardInput('text', translate('settings.taskProperties.customUserFields.placeholders.propertyKey'), field.key);
        const typeSelect = createCardSelect([
            { value: 'text', label: translate('settings.taskProperties.customUserFields.types.text') },
            { value: 'number', label: translate('settings.taskProperties.customUserFields.types.number') },
            { value: 'boolean', label: translate('settings.taskProperties.customUserFields.types.boolean') },
            { value: 'date', label: translate('settings.taskProperties.customUserFields.types.date') },
            { value: 'list', label: translate('settings.taskProperties.customUserFields.types.list') }
        ], field.type);

        nameInput.addEventListener('change', () => {
            field.displayName = nameInput.value;
            save();
            renderUserFieldsList(container, plugin, save);
        });

        keyInput.addEventListener('change', () => {
            field.key = keyInput.value;
            save();
            renderUserFieldsList(container, plugin, save);
        });

        typeSelect.addEventListener('change', () => {
            field.type = typeSelect.value as any;
            save();
            renderUserFieldsList(container, plugin, save);
        });

        createCard(container, {
            id: field.id,
            collapsible: true,
            defaultCollapsed: true,
            header: {
                primaryText: field.displayName || translate('settings.taskProperties.customUserFields.defaultNames.unnamedField'),
                secondaryText: field.key || translate('settings.taskProperties.customUserFields.defaultNames.noKey'),
                meta: [createStatusBadge(field.type.charAt(0).toUpperCase() + field.type.slice(1), 'default')],
                actions: [
                    createDeleteHeaderButton(() => {
                        if (plugin.settings.userFields) {
                            plugin.settings.userFields.splice(index, 1);
                            save();
                            renderUserFieldsList(container, plugin, save);
                        }
                    }, translate('settings.taskProperties.customUserFields.deleteTooltip'))
                ]
            },
            content: {
                sections: [{
                    rows: [
                        { label: translate('settings.taskProperties.customUserFields.fields.displayName'), input: nameInput },
                        { label: translate('settings.taskProperties.customUserFields.fields.propertyKey'), input: keyInput },
                        { label: translate('settings.taskProperties.customUserFields.fields.type'), input: typeSelect }
                    ]
                }]
            }
        });
    });
}