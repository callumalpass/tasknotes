import { Notice, setTooltip, Setting } from 'obsidian';
import TaskNotesPlugin from '../../main';
import { StatusConfig, FieldMapping } from '../../types';
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

    // Ensure user fields array exists
    if (!Array.isArray(plugin.settings.userFields)) {
        plugin.settings.userFields = [];
    }

    // Custom Statuses Section
    createSectionHeader(container, 'Task Statuses');
    createHelpText(container, 'Customize the status options available for your tasks. These statuses control the task lifecycle and determine when tasks are considered complete.');

    // Status help section
    const statusHelpContainer = container.createDiv('tasknotes-settings__help-section');
    statusHelpContainer.createEl('h4', { text: 'How statuses work:' });
    const statusHelpList = statusHelpContainer.createEl('ul');
    statusHelpList.createEl('li', { text: 'Value: The internal identifier stored in your task files (e.g., "in-progress")' });
    statusHelpList.createEl('li', { text: 'Label: The display name shown in the interface (e.g., "In Progress")' });
    statusHelpList.createEl('li', { text: 'Color: Visual indicator color for the status dot and badges' });
    statusHelpList.createEl('li', { text: 'Completed: When checked, tasks with this status are considered finished and may be filtered differently' });
    statusHelpContainer.createEl('p', {
        text: 'The order below determines the sequence when cycling through statuses by clicking on task status badges.',
        cls: 'settings-help-note'
    });

    // Status list container - using card layout like webhooks
    const statusList = container.createDiv('tasknotes-statuses-container');
    renderStatusList(statusList, plugin, save);
    
    // Add status button
    new Setting(container)
        .setName('Add new status')
        .setDesc('Create a new status option for your tasks')
        .addButton(button => button
            .setButtonText('Add status')
            .onClick(async () => {
                const newId = `status_${Date.now()}`;
                const newStatus = {
                    id: newId,
                    value: '',
                    label: '',
                    color: '#6366f1',
                    completed: false,
                    isCompleted: false,
                    order: plugin.settings.customStatuses.length
                };
                plugin.settings.customStatuses.push(newStatus);
                save();
                renderStatusList(statusList, plugin, save);
            }));

    createValidationNote(container, 'Note: You must have at least 2 statuses, and at least one status must be marked as "Completed".');

    // Custom Priorities Section
    createSectionHeader(container, 'Task Priorities');
    createHelpText(container, 'Customize the priority levels available for your tasks. Priority weights determine sorting order and visual hierarchy in your task views.');

    // Priority help section
    const priorityHelpContainer = container.createDiv('tasknotes-settings__help-section');
    priorityHelpContainer.createEl('h4', { text: 'How priorities work:' });
    const priorityHelpList = priorityHelpContainer.createEl('ul');
    priorityHelpList.createEl('li', { text: 'Value: The internal identifier stored in your task files (e.g., "high")' });
    priorityHelpList.createEl('li', { text: 'Display Label: The display name shown in the interface (e.g., "High Priority")' });
    priorityHelpList.createEl('li', { text: 'Color: Visual indicator color for the priority dot and badges' });
    priorityHelpList.createEl('li', { text: 'Weight: Numeric value for sorting (higher weights appear first in lists)' });
    priorityHelpContainer.createEl('p', {
        text: 'Tasks are automatically sorted by priority weight in descending order (highest weight first). Weights can be any positive number.',
        cls: 'settings-help-note'
    });

    // Priority list container - using card layout
    const priorityList = container.createDiv('tasknotes-priorities-container');
    renderPriorityList(priorityList, plugin, save);
    
    // Add priority button
    new Setting(container)
        .setName('Add new priority')
        .setDesc('Create a new priority level for your tasks')
        .addButton(button => button
            .setButtonText('Add priority')
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

    createValidationNote(container, 'Note: You must have at least 1 priority. Higher weights take precedence in sorting and visual hierarchy.');

    // Field Mapping Section
    createSectionHeader(container, 'Field Mapping');
    
    // Warning message
    const warning = container.createDiv('tasknotes-settings__warning');
    warning.createEl('strong', { text: '⚠️ Warning: ' });
    warning.appendText('TaskNotes will read AND write using these property names. Changing these after creating tasks may cause inconsistencies.');
    
    createHelpText(container, 'Configure which frontmatter properties TaskNotes should use for each field.');

    renderFieldMappingTable(container, plugin, save);

    createButtonSetting(container, {
        name: 'Reset field mappings',
        desc: 'Reset all field mappings to default values',
        buttonText: 'Reset to Defaults',
        onClick: async () => {
            // Import the DEFAULT_FIELD_MAPPING - we'll need to check if this is accessible
            try {
                const { DEFAULT_FIELD_MAPPING } = await import('../../settings/defaults');
                plugin.settings.fieldMapping = { ...DEFAULT_FIELD_MAPPING };
                save();
                renderTaskPropertiesTab(container.parentElement!, plugin, save);
                new Notice('Field mappings reset to defaults');
            } catch (error) {
                console.error('Error resetting field mappings:', error);
                new Notice('Failed to reset field mappings');
            }
        }
    });

    // Custom User Fields Section
    createSectionHeader(container, 'Custom User Fields');
    createHelpText(container, 'Define custom frontmatter properties to appear as type-aware filter options across views. Each row: Display Name, Property Name, Type.');

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
        .setName('Add new user field')
        .setDesc('Create a new custom field that will appear in filters and views')
        .addButton(button => button
            .setButtonText('Add user field')
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
    
    if (!plugin.settings.customStatuses || plugin.settings.customStatuses.length === 0) {
        showCardEmptyState(
            container,
            'No custom statuses configured. Add a status to get started.',
            'Add Status',
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
        const valueInput = createCardInput('text', 'in-progress', status.value);
        const labelInput = createCardInput('text', 'In Progress', status.label);
        const colorInput = createCardInput('color', '', status.color);
        
        const completedCheckbox = document.createElement('input');
        completedCheckbox.type = 'checkbox';
        completedCheckbox.checked = status.isCompleted || false;
        completedCheckbox.addClass('tasknotes-card-input');

        const metaElements = status.isCompleted ? [createStatusBadge('Completed', 'completed')] : [];

        const deleteStatus = () => {
            const confirmDelete = confirm(`Are you sure you want to delete the status "${status.label || status.value}"?`);
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
                        { label: 'Value:', input: valueInput },
                        { label: 'Label:', input: labelInput },
                        { label: 'Color:', input: colorInput },
                        { label: 'Completed:', input: completedCheckbox }
                    ]
                }]
            }
        };

        const statusCard = createCard(container, cardConfig);

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
                    metaContainer.appendChild(createStatusBadge('Completed', 'completed'));
                }
            }
            save();
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
    
    if (!plugin.settings.customPriorities || plugin.settings.customPriorities.length === 0) {
        showCardEmptyState(
            container,
            'No custom priorities configured. Add a priority to get started.',
            'Add Priority',
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
        const valueInput = createCardInput('text', 'high', priority.value);
        const labelInput = createCardInput('text', 'High Priority', priority.label);
        const colorInput = createCardInput('color', '', priority.color);
        const weightInput = createCardNumberInput(0, undefined, 1, priority.weight);

        valueInput.addEventListener('change', () => {
            priority.value = valueInput.value;
            save();
            renderPriorityList(container, plugin, save);
        });

        labelInput.addEventListener('change', () => {
            priority.label = labelInput.value;
            save();
            renderPriorityList(container, plugin, save);
        });

        colorInput.addEventListener('change', () => {
            priority.color = colorInput.value;
            save();
            renderPriorityList(container, plugin, save);
        });

        weightInput.addEventListener('input', () => {
            const weight = parseInt(weightInput.value);
            if (!isNaN(weight) && weight >= 0) {
                priority.weight = weight;
                save();
                renderPriorityList(container, plugin, save);
            }
        });

        createCard(container, {
            id: priority.id,
            colorIndicator: { color: priority.color },
            header: {
                primaryText: priority.label || priority.value || 'untitled',
                secondaryText: `Weight: ${priority.weight}`,
                actions: [
                    createDeleteHeaderButton(() => {
                        if (plugin.settings.customPriorities.length <= 1) {
                            new Notice('You must have at least one priority');
                            return;
                        }
                        plugin.settings.customPriorities.splice(index, 1);
                        save();
                        renderPriorityList(container, plugin, save);
                    }, 'Delete priority')
                ]
            },
            content: {
                sections: [{
                    rows: [
                        { label: 'Value:', input: valueInput },
                        { label: 'Label:', input: labelInput },
                        { label: 'Color:', input: colorInput },
                        { label: 'Weight:', input: weightInput }
                    ]
                }]
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
    // Create mapping table
    const table = container.createEl('table', { cls: 'tasknotes-settings__table' });
    const header = table.createEl('tr');
    header.createEl('th', { cls: 'tasknotes-settings__table-header', text: 'TaskNotes field' });
    header.createEl('th', { cls: 'tasknotes-settings__table-header', text: 'Your property name' });

    const fieldMappings: Array<[keyof FieldMapping, string]> = [
        ['title', 'Title'],
        ['status', 'Status'],
        ['priority', 'Priority'],
        ['due', 'Due date'],
        ['scheduled', 'Scheduled date'],
        ['contexts', 'Contexts'],
        ['projects', 'Projects'],
        ['timeEstimate', 'Time estimate'],
        ['recurrence', 'Recurrence'],
        ['dateCreated', 'Created date'],
        ['completedDate', 'Completed date'],
        ['dateModified', 'Modified date'],
        ['archiveTag', 'Archive tag'],
        ['timeEntries', 'Time entries'],
        ['completeInstances', 'Complete instances'],
        ['pomodoros', 'Pomodoros'],
        ['icsEventId', 'ICS Event ID'],
        ['icsEventTag', 'ICS Event Tag'],
        ['reminders', 'Reminders']
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
                new Notice(`Failed to update field mapping for ${label}. Please try again.`);
            }
        });
    });
}

function renderUserFieldsList(container: HTMLElement, plugin: TaskNotesPlugin, save: () => void): void {
    container.empty();

    if (!plugin.settings.userFields) {
        plugin.settings.userFields = [];
    }
    
    if (plugin.settings.userFields.length === 0) {
        showCardEmptyState(
            container,
            'No custom user fields configured. Add a field to create custom properties for your tasks.',
            'Add User Field',
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
        const nameInput = createCardInput('text', 'Display Name', field.displayName);
        const keyInput = createCardInput('text', 'property-name', field.key);
        const typeSelect = createCardSelect([
            { value: 'text', label: 'Text' },
            { value: 'number', label: 'Number' },
            { value: 'boolean', label: 'Boolean' },
            { value: 'date', label: 'Date' }
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
            header: {
                primaryText: field.displayName || 'Unnamed Field',
                secondaryText: field.key || 'no-key',
                meta: [createStatusBadge(field.type.charAt(0).toUpperCase() + field.type.slice(1), 'default')],
                actions: [
                    createDeleteHeaderButton(() => {
                        if (plugin.settings.userFields) {
                            plugin.settings.userFields.splice(index, 1);
                            save();
                            renderUserFieldsList(container, plugin, save);
                        }
                    }, 'Delete field')
                ]
            },
            content: {
                sections: [{
                    rows: [
                        { label: 'Display Name:', input: nameInput },
                        { label: 'Property Key:', input: keyInput },
                        { label: 'Type:', input: typeSelect }
                    ]
                }]
            }
        });
    });
}